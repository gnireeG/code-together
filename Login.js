class Login{

    // the constructor takes in bcrypt (to hash passwords) and a db to connect to
    constructor(p_bcrypt, p_db){
        this.bcrypt = p_bcrypt
        this.db = p_db
        this.db.loadDatabase()
    }

    // method to verify a login (compare user to password)
    verifyLogin(p_user, p_password, callBack){
        
        this.db.find({username: p_user}, (err, docs) =>{
            // no user found with that username
            if(docs.length === 0){
                callBack(false)
            } else{
                this.bcrypt.compare(p_password, docs[0].password, (err, result) =>{
                    // if the the entered password is correct, call the callback with true and the user's id
                    if(result){
                        callBack(true, docs[0]._id)
                    } else{
                    // if the password is wrong, call the callback with false
                        callBack(false)
                    }
                })
            }
        })
    }

    // method to register a new user
    register(p, callBack){
        const {username, password, email, firstName, lastName} = p
        // checking if a username with that username allready exists
        this.db.find({username: username}, (err, docs)=>{
            // length === 0 means no user with that username exists in the db
            if(docs.length === 0){
                
                // checking if a user with that email allready exists
                this.db.find({email: email}, (err, docs) =>{
                    // length === 0 means no user with that email exists in the db
                    if(docs.length === 0){

                        // hashing the password
                        this.bcrypt.hash(password, 10, (err, hash) =>{
                            
                            // creating the new user object to insert into the DB
                            const user = {
                                username: username,
                                password: hash,
                                email: email,
                                firstName: firstName,
                                lastName: lastName
                            }

                            // inserting the new user, on success redirect to the dashboard (redirect will be done in the frontend)
                            this.db.insert(user, (err, newDoc) =>{
                                
                                callBack({success: true, redirect: '/dashboard', userId: newDoc._id})
                            })
                        })
                    // email allready exists
                    } else{
                        callBack({success: false, err: 'email'})
                    }
                })
            // username allready exists
            } else{
                callBack({success: false, err: 'username'})
            }
        })
    }

}

module.exports = Login