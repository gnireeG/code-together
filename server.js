// http server
const express = require('express')
// sessions for express server
const session = require('express-session')
// used to store session data
const NedbSessionStore = require('nedb-session-store')(session)
// Database
const Datastore = require('nedb')
const bodyParser = require('body-parser')
// password hashing
const bcrypt = require('bcrypt')
// sanitizing user input
const expressSanitizer = require('express-sanitizer')
const WebSocket = require('ws')
// my own Login class
const Login = require('./Login')
const http = require('http')

// using app = express() and an httpServer because only with express, websocket wouldn't work.
const app = express()
const httpServer = http.createServer(app)


// system variables
require('dotenv').config()

const port = process.env.PORT || 3000

app.use(express.static('public'))
// user input sanitizer
app.use(expressSanitizer())
app.set('view engine', 'ejs')
app.use(bodyParser.json())

// configuring the session i will use for login etc.
app.use(session({
    secret: process.env.SECRET || 'ENTER YOUR SECRET KEY IN ENV VARIABLES!',
    resave: false,
    saveUninitialized: false,
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 14*24*60*60*1000
    },
    store: new NedbSessionStore({
        filename: 'db/sessions.db'
    })
}))


/****************** ROUTES ******************/

/* index */
app.get('/', (req, res) =>{

    // if the user is logged in, show his username in the top right corner
    if(req.session.isLoggedIn){
        const db = new Datastore('db/users.db')
        db.loadDatabase()
        db.find({_id: req.session.userId}, (err, docs)=>{
            const username = docs[0].username
            res.render('index', {username: username})
        })
    } else{
        res.render('index', {username: null})
    }
    
})

/* Dashboard (only logged in) */
app.get('/dashboard', (req, res) =>{
    if(req.session.isLoggedIn){
        const db = new Datastore('db/users.db')
        const codedb = new Datastore('db/code.db')

        codedb.loadDatabase()
        db.loadDatabase()
        db.find({_id: req.session.userId}, (err, docs) =>{
            const username = docs[0].username
            let projects = []
            // find all the projects the logged in user has created
            codedb.find({user:req.session.userId}, (err, docs)=>{

                if(docs.length === 0){
                    res.render('dashboard', {username: username, projects: 0})
                } else{
                    docs.forEach(doc =>{
                        projects.push(doc)
                    })
                    res.render('dashboard', {username: username, projects: projects})
                }
            })
            
        })

    // if the session isn't set (user is not logged in) send him to the homepage
    } else{
        res.redirect('/')
    }
})

// logout
app.get('/logout', (req, res) =>{
    if(req.session){
        req.session.isLoggedIn = false
        req.session.userId = null
    }
    res.redirect('/')
})

// register

app.get('/register', (req, res) =>{
    res.render('register')
})

app.post('/register', (req, res) =>{
    let error = false

    // basic check to see if every element is at least 3 characters long
    for(elem in req.body){
        if(elem.length < 3){
            error = true
        }
    }
    if(!error){
        
        const db = new Datastore('db/users.db')
        db.loadDatabase()

        // sanitizing all user inputs
        for(elem in req.body){
            elem = req.sanitize(elem)
        }

        const login = new Login(bcrypt, db)
        login.register(req.body, (r) =>{
            // if the user has successfully registered, log him in and send him to the dashboard
            if(r.success){
                req.session.isLoggedIn = true
                req.session.userId = r.userId
                res.send({success: true, redirect: r.redirect})
            } else{
                res.send({success: false, err: r.err})
            }
        })
    } else{
        res.send({success: false})
    }
})

/* POST request for login */
app.post('/login', (req, res) =>{

    // creating a new instance of the login class.
    // params are bcrypt (for hashing the password) and the user Database
    const login = new Login(bcrypt, new Datastore('db/users.db'))
    // sanitizing the user inputs
    const username = req.sanitize(req.body.user)
    const password = req.sanitize(req.body.pw)
    // the method verifyLogin takes in the username and checks it with the hashed password.
    // in a callback 2 variables get sent back. Success (self explanatory) and the id of the user who logged in
    login.verifyLogin(username, password, (success, id) =>{
        // if the login was successfull, set the sessions aber redirect to the dashboard
        if(success){
            req.session.isLoggedIn = true
            req.session.userId = id
            res.send({success: true, redirect: '/dashboard'})
        // if the login failed, clear the session and send back success = false (for error handling in the frontend)
        } else{
            req.session.isLoggedIn = false
            req.session.userId = null
            res.send({success: false})
        }
    })
})

/* POST FOR NEW PROJECT */
// when a user creates a new project, it creates a new DB entry and sends him to the 'edit' page of that project
app.post('/newproject', (req, res) =>{
    // only logged in users can create new projects
    if(req.session.isLoggedIn && req.session.userId){
        const db = new Datastore('db/code.db')
        db.loadDatabase()

        db.insert({
            user: req.session.userId,
            title: 'New Project',
            code: 'Start coding!\nOpen the menu to change the project settings',
            lang: 'none',
            privacy: 'public',
            contributors: [req.session.userId]
        },
            (err, newDoc) =>{
            res.send({success: true, redirect: `/edit/${newDoc._id}`})
        })
    } else{
        res.send({success: false})
    }
})

/* GET FOR EDITING PROJECT */

app.get('/edit/:id', (req, res) =>{
    const id = req.params.id
    const db = new Datastore('db/code.db')
    db.loadDatabase()
    db.find({_id: id}, (err, docs) =>{
        // the project with the requested id could not be found
        if(docs.length === 0){
            res.render('code', {success: false, error: 'codeNotFound'})
        } else{
            // if the privacy is 'public', anyone can access this project -> render the page
            if(docs[0].privacy === 'public'){
                res.render('code', {success: true, project: docs[0]})
            } else{
                const user = req.session.userId
                // if the privacy is 'protected', only the creator of the project and contributors can edit the project
                if(user === docs[0].user || docs[0].contributors.includes(user)){
                    res.render('code', {success: true, project: docs[0]})
                } else{
                    // if the current user is not the creator and is not in the contributors list (or is not logged in),
                    // render the page with the error message 'noPermission'
                    res.render('code', {success: false, error: 'noPermission'})
                }
            }
            
        }
    })
})

// loading the contributors for the /edit/:id page
app.post('/loadcontributors', (req, res) =>{
    const db = new Datastore('db/code.db')
    const userdb = new Datastore('db/users.db')
    userdb.loadDatabase()
    db.loadDatabase()
    db.find({_id: req.body.id}, (err, docs) =>{
        // the project could not be found
        if(docs.length === 0){
            res.send({success: false})
        } else{
            let contributors = []

            /* for every person i have to make a request to users.db to get the username of the user,
                because in code.db i only save the user._id in 'contributors'
            */
            for(let i = 0; i < docs[0].contributors.length; i++){
                let person = docs[0].contributors[i]
                if(person !== null){
                    userdb.find({_id: person}, (err, userdoc)=>{
                        if(userdoc.length !== 0){
                            // pushing all usernames into the array contributors
                            contributors.push({username:userdoc[0].username, id: userdoc[0]._id})
                            // when i reach the last person, i render the page
                            if(i === docs[0].contributors.length - 1){
                                res.send({success: true, contributors: contributors})
                            }
                        }
                    })
                }
            }
        }
    })
})

app.post('/searchcontributor', (req, res) =>{
    const db = new Datastore('db/users.db')
    db.loadDatabase()

    db.find({username: req.body.searchVal}, (err, doc) =>{
        if(doc.length === 0){
            res.send({success: false})
        } else{
            res.send({success: true, username: doc[0].username, id: doc[0]._id})
        }
    })
})


/********************** WEBSOCKET *******************************/

const socketServer = new WebSocket.Server({'server': httpServer})
let clients = {}

/* structure of the clients object
clients = {
    firstProjectID: [client, client, client],
    secondProjectID: [client, client]
}
*/

socketServer.on('connection', (client) => {
    
    // id of the project the client wants to edit (id is the same id as in code.db[_id])
    const codeId = client.protocol
    //console.log('new client connected on '+ codeId)
    // if there is allready an ongoing connection to that project, push the new client
    if(clients[codeId]){
        clients[codeId].push(client)
    // else create a new entry in the clients{} with an array consisting of the new client
    } else{
        clients[codeId] = [client]
    }

    // send the received code to all the other clients
    // who are connected to that project
    client.on('message', (message) =>{
        //console.log(JSON.parse(message))
        const data = JSON.parse(message)
        const codedb = new Datastore('db/code.db')
        codedb.loadDatabase()

        // switching the type to determine what to do with the received data
        switch(data.type){
            // update the code
            case 'code':
                codedb.update({_id: codeId}, {$set: {code: data.code}}, (err, num) =>{})
                //console.log('code updated')
                break
            // update the privacy setting of the project
            case 'privacy':
                codedb.update({_id: codeId}, {$set: {privacy: data.privacy}}, (err, num) =>{})
                //console.log('privacy updated')
                break
            // update the language of the project
            case 'lang':
                codedb.update({_id: codeId}, {$set: {lang: data.lang}}, (err, num) =>{})
                //console.log('lang updated')
                break
            // removing one user from the contributors list
            case 'remove-user':
                codedb.find({_id: codeId}, (err, doc) =>{
                    let users = doc[0].contributors

                    // never remove the user who created the project from the contributors list
                    if(doc[0].user !== data.id){
                        // splicing the contributors array to remove the requested user
                        users.splice(users.indexOf(data.id), 1)
                        // updating the entry in the DB
                        codedb.update({_id: codeId}, {$set: {contributors: users}}, (err, num) =>{})
                    }
                    
                })
                break
            // updating the title
            case 'title':
                codedb.update({_id: codeId}, {$set: {title: data.title}}, (err, num) =>{})
                break
            case 'add-contributor':
                codedb.find({_id: codeId}, (err, doc) =>{
                    let users = doc[0].contributors

                    // never remove the user who created the project from the contributors list
                    if(!users.includes(data.id)){
                        // splicing the contributors array to remove the requested user
                        users.push(data.id)
                        // updating the entry in the DB
                        codedb.update({_id: codeId}, {$set: {contributors: users}}, (err, num) =>{})
                    }
                    
                })
                break
            default:
                break
        }
        // forwarding the received message to all other connected clients (not pings, theser are just to keep the connection alive)
        if(data.type !== 'ping'){
            clients[codeId].forEach(oneClient =>{
                // don't send the received message back to the sender
                if(oneClient !== client){
                    oneClient.send(message)
                }
            })
        }
        
    })

    // remove the client who closed the connection from the corresponding array
    client.on('close', closeClient => {
        const index = clients[codeId].indexOf(closeClient)
        clients[codeId].splice(index,1)
    })

})

/* 404 HANLDING */

app.use(function(req, res, next){
    res.status(404).render('404', {errorPath: req.path})
})

httpServer.listen(port, (req, res) =>{
    console.log('server is listeing on port ' + port)
})