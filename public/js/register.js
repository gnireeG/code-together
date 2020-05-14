function get(str){
    return document.getElementById(str)
}

const form = get('registerform'),
firstName = get('firstname'),
lastName = get('lastname'),
username = get('username'),
email = get('email'),
password = get('password')

form.addEventListener('submit', (e) =>{
    e.preventDefault()

    // removing error messages from possible earlier login fails
    document.getElementById('loginerror').style.display = 'none'
    document.getElementById('usernameerror').style.display = 'none'
    document.getElementById('emailerror').style.display = 'none'

    // basic check to see if all fields were filled
    const required = [firstName, lastName, username, email, password]
    let error = false;
    required.forEach(elem =>{
        elem.style.borderColor = 'initial'
        if(elem.value.length < 3){
            elem.style.borderColor = 'red'
            error = true
        }
    })

    if(!error){
        async function register(){
            const bodyContent = {
                firstName: firstName.value,
                lastName: lastName.value,
                username: username.value,
                email: email.value,
                password: password.value
            }

            

            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: firstName.value,
                    lastName: lastName.value,
                    username: username.value,
                    email: email.value,
                    password: password.value
                })
            })
            required.forEach(elem =>{
                elem.style.background = 'gray'
            })
            const data = await response.json()

            // if the registering was successfull, go to the dashboard.
            if(data.success){
                window.location = data.redirect
            // if the registering was not successfull, show the error
            } else{
                document.getElementById('loginerror').style.display = 'block'
                if(data.err){
                    document.getElementById(data.err+'error').style.display = 'block'
                }
                
                required.forEach(elem =>{
                    elem.style.background = ''
                })
            }
        }

        register()
    }

})