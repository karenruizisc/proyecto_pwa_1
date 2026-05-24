
const API_URL = "http://localhost:8080/api/auth/login";



const loginForm = document.getElementById("loginForm");

const message = document.getElementById("message");

const emailInput = document.getElementById("email");

const passwordInput = document.getElementById("password");



loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = emailInput.value.trim();

    const password = passwordInput.value.trim();


    if(email === "" || password === ""){

        showMessage(
            "Todos los campos son obligatorios",
            "error"
        );

        return;
    }

    const loginData = {

        email: email,

        password: password

    };

    try{

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(loginData)

        });

        const data = await response.json();


        if(!response.ok){

            throw new Error(
                data.message || "Error al iniciar sesión"
            );

        }

        /*
        ========================================
        RESPUESTA ESPERADA DEL BACKEND
        ========================================

        {
            "token": "eyJhbGciOiJIUzI1NiJ9...",
            "user": {
                "id": 1,
                "nombre": "Juan",
                "email": "juan@gmail.com"
            }
        }

        */


        localStorage.setItem(
            "token",
            data.token
        );


        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );


        showMessage(
            "Inicio de sesión exitoso",
            "success"
        );


        setTimeout(() => {

            window.location.href = "index.html";

        }, 1000);

    }catch(error){

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

    }

});


function showMessage(text, type){

    message.textContent = text;

    message.className = `message ${type}`;

    message.style.display = "block";

}


function getToken(){

    return localStorage.getItem("token");

}


function logout(){

    localStorage.removeItem("token");

    localStorage.removeItem("user");

    window.location.href = "index.html";

}


function isAuthenticated(){

    const token = localStorage.getItem("token");

    return token !== null;

}