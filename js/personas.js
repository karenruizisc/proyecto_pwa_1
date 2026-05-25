
const API_URL = "https://elprofehugo.online/api/v1/personas/registro";

const loginForm = document.getElementById("PersonForm");

const nombres = document.getElementById("nombres").value.trim();

const apellidos = document.getElementById("apellidos").value.trim();

const tipoDocumento = document.getElementById("tipoDocumento").value.trim();

const documento = document.getElementById("documento").value.trim();

const direccion = document.getElementById("direccion").value.trim();

const telefono = document.getElementById("telefono").value.trim();

const ciudad = document.getElementById("ciudad").value.trim();

const usuario = document.getElementById("usuario").value.trim();

const contrasena = document.getElementById("contrasena").value.trim();


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

    const PersonData = {
        nombres,
        apellidos,
        tipoDocumento,
        documento,
        direccion,
        telefono,
        ciudad,
        usuario,
        contrasena
    };

    try{

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json",
                "authorization": `Bearer ${getToken()}`
            },

            body: JSON.stringify(PersonData)

        });

        const data = await response.json();


        if(!response.ok){

            throw new Error(
                data.message || "Error al registrar persona"
            );

        }else{

        }



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
