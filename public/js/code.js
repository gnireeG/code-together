// this document is only loaded to edit a project
let id = location.href.split('/')
id = id[id.length-1]

const contributorList = document.getElementById('contributor-list')
const initLang = document.getElementById('initiallang').value

const lang = document.getElementById('lang-options')
const priv = document.getElementById('input-priv')
const title = document.getElementById('projecttitle')
const addContributorInput = document.getElementById('add-contributor')
const addContributorMsg = document.getElementById('add-contributor-msg')
const addContributorBtn = document.getElementById('adduser')


let HOST = location.origin.replace(/^http/, 'ws')
const ws = new WebSocket(HOST, id)

ws.onopen = () =>{
    //console.log('connected!')

    // every minute i send a ping to the server to keep the connection alive longer than 2 minutes without interaction
    function ping(){
        ws.send(JSON.stringify({type: 'ping'}))
    }
    setInterval(ping, 6000)
}

// setting the code received from the WebSocket
ws.onmessage = (e) =>{
    const data = JSON.parse(e.data)
    switch(data.type){
        case 'code':
            // first getting the current Cursor position, 2nd replacing the code, 3rd replacing the cursor in the same position
            // without these steps the cursor jumps to the start when the code gets replaced
            const cursorPos = codeMirror.getCursor()
            codeMirror.setValue(data.code)
            codeMirror.setCursor(cursorPos)
            break
        // changing the privacy setting
        case 'privacy':
            if(data.privacy === 'protected'){
                priv.checked = true
            } else if(data.privacy === 'public'){
                priv.checked = false
            }
            break
        // changing the programming language dropdown and codemirror settings
        case 'lang':
            codeMirror.setOption("mode", data.lang)
            const options = lang.options
            for(let opt, i = 0; opt = options[i]; i++){
                if(opt.value == data.lang){
                    lang.selectedIndex = i
                }
            }
            break
        // removing a contributor
        case 'remove-user':
            const userDom = document.querySelector(`[data-id=${data.id}]`)
            userDom.parentNode.removeChild(userDom)
            break
        // updating the title
        case 'title':
            title.value = data.title
            break
        // adding a contributor
        case 'add-contributor':
            showContributor({username: data.username, id: data.id})
            break
        default:
            break
    }
}

ws.onclose = () =>{
    document.getElementById('closemsg').style.display = 'block'
}


// CodeMirror is used for syntax highlighting

let codeMirror = CodeMirror(document.getElementById('codeeditor'), {
    value: 'Start coding',
    // initLang comes from an input type=hidden which is rendered server sided on the GET request
    mode: initLang,
    theme: 'ayu-mirage',
    lineNumbers: true,
    tabSize: 2
})

// everytime the user types something, the code will be sent to the other connected users
const textarea = document.getElementsByTagName('textarea')[0]
textarea.addEventListener('keyup', () =>{
    ws.send(JSON.stringify({type: 'code', code: codeMirror.getValue()}))
})

// on page load, set the value received from the server
codeMirror.setValue(document.getElementById('initialcode').value)


// changing settings


lang.addEventListener('change', () =>{
    const newLang = lang.value
    // changing the language mode for the code editor
    codeMirror.setOption("mode", newLang)
    // sending the update to the other connected users
    ws.send(JSON.stringify({type: 'lang', lang: newLang}))
})

// when changing the checkbox for the privacy, sending the update to the other clients
priv.addEventListener('change', () =>{
    let val
    if(priv.checked){
        val = 'protected'
    } else{
        val = 'public'
    }
    ws.send(JSON.stringify({type: 'privacy', privacy: val}))
})

// function to load the contributors for this project
async function loadContributors(){
    const body = {
        id: id
    }
    const response = await fetch('/loadcontributors', {
        method: 'POST',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    const res = await response.json()
    res.contributors.forEach(user =>{
        showContributor(user)
    })
}

loadContributors()

// function to display the loaded contributors
function showContributor(user){
    // not adding a user twice to the page
    if(!document.querySelector(`#contributor-list [data-id=${user.id}]`)){
        let li = document.createElement('li')
        li.classList.add('flex')
        let span = document.createElement('span')
        span.innerText = user.username
        li.appendChild(span)
        li.setAttribute('data-id', user.id)
        // Not adding the remove button for the admin of the project
        if(document.getElementById('projectadmin').value !== user.id){
            let btn = document.createElement('button')
            btn.innerText = 'remove'
            btn.setAttribute('data-remove-user', 'true')
            li.appendChild(btn)
        }
        
        contributorList.appendChild(li)
    }
}

// event listener which triggers the removal of a contributor
document.addEventListener('click', function(e){
    if(e.target && e.target.hasAttribute('data-remove-user')){
        const userToRemove = e.target.parentNode.getAttribute('data-id')
        // sending the update to the other clients
        ws.send(JSON.stringify({type: 'remove-user', id: userToRemove}))
        // removing the user on this client
        const userDom = document.querySelector(`[data-id=${userToRemove}]`)
        userDom.parentNode.removeChild(userDom)
    }
})

// updating the title
title.addEventListener('keyup', () =>{
    ws.send(JSON.stringify({type: 'title', title: title.value}))
})

// this function is used as a named callback to add a user to the contributors
let userToAdd = {}
function addUserHandler(){
    ws.send(JSON.stringify({type: 'add-contributor', username: userToAdd.username, id: userToAdd.id}))
    showContributor(userToAdd)
}

// search function for adding contributors
addContributorInput.addEventListener('keyup', async () =>{
    const val = addContributorInput.value
    if(val.length > 2){
        const response = await fetch('/searchcontributor', {
            method: 'POST',
            headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({searchVal: val})
        })
        const res = await response.json()
        if(res.success){
            userToAdd = {username: res.username, id: res.id}
            addContributorMsg.innerText = 'Found a user!'
            addContributorMsg.style.color = 'green'
            addContributorBtn.style.backgroundColor = 'green'
            addContributorBtn.disabled = false
            //binding the add user button to the handler from above
            addContributorBtn.addEventListener('click', addUserHandler)
        } else{
            addContributorMsg.innerText = 'No user found'
            addContributorMsg.style.color = 'red'
            addContributorBtn.style.backgroundColor = 'gray'
            addContributorBtn.disabled = true
            // removing the event handler from above because this user doesn't exist
            addContributorBtn.removeEventListener('click', addUserHandler)
        }
    }
    
})