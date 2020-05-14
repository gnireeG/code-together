// login
if(document.getElementById('login-submit')){
    document.getElementById('loginform').addEventListener('submit', (e) =>{
        e.preventDefault()
        logIn()
    })
    
    async function logIn(){
        const username = document.getElementById('username').value
        const password = document.getElementById('password').value
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({user: username, pw: password})
        })
        const res = await response.json()
        if(res.success){
            window.location = res.redirect
        } else{
            document.getElementById('loginerror').style.display = 'block'
            
        }
    }
}

// code menu toggle
if(document.getElementById('menu-toggle')){
    document.getElementById('menu-toggle').addEventListener('click', () =>{
        document.getElementById('menu').classList.toggle('open')
        document.getElementById('codeeditor').classList.toggle('collapsed')
    })
}

// new project
if(document.getElementById('newproject-btn')){
    document.getElementById('newproject-btn').addEventListener('click', () =>{
        async function newProject(){
            const response = await fetch('/newproject', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            const res = await response.json()
            if(res.success){
                window.location = res.redirect
            } else{
                console.log('Something went wrong. Try again')
            }
        }

        newProject()

    })
}

// dropdown for login / user
if(document.getElementById('user-header')){
    const dropDownToggle = document.getElementById('dropdown-toggle')
    const header = document.getElementById('user-header')
    dropDownToggle.addEventListener('click', () =>{
        header.classList.toggle('open')
    })
}
