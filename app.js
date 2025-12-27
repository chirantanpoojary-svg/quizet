const SERVER = "https://Quizet.pythonanywhere.com"
let state = {session_id: null, username: null, phone: null, token: null, expiry: 0}
let c = ""
let foc = 0
let stopTimer = false

const app = document.getElementById("app")
const bg = document.getElementById("bg")
const fontToggle = document.getElementById("fontToggle")

function resizeBg() {
    bg.style.width = window.innerWidth + "px"
    bg.style.height = window.innerHeight + "px"
}
resizeBg()
window.onresize = resizeBg

setInterval(resizeBg, 1000)

fontToggle.onchange = () => {
    if (!fontToggle.checked) document.body.style.fontFamily = "Times New Roman"
    else document.body.style.fontFamily = "Dancing"
}

function clear() {
    app.innerHTML = ""
}

function loginScreen() {
    clear()
    app.innerHTML = `
        <h1 style="font-size:32px;">QUIZET</h1>
        <img src="assets/logo.png" style="width:60px;height:60px;opacity:.4">
        <div style="margin-top:20px;font-size:22px;">Login (username + phone)</div>
        <input id="user" placeholder="Username">
        <input id="phone" placeholder="Phone">
        <button id="loginBtn">Login</button>
        <div id="msg" style="margin-top:12px;font-size:18px;"></div>
    `
    document.getElementById("loginBtn").onclick = async () => {
        let u = document.getElementById("user").value.trim()
        let p = document.getElementById("phone").value.trim()
        if (!u || !p) {
            document.getElementById("msg").innerText = "Enter username and phone"
            return
        }
        try {
            let r = await fetch(SERVER + "/login", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({username:u, phone:p})
            })
            if (r.status == 200) {
                state.username = u
                state.phone = p
                home()
                return
            }
        } catch(e){}
        document.getElementById("msg").innerText = "Login failed"
    }
}

function home() {
    clear()
    app.innerHTML = `
        <div style="font-size:24px;">Welcome ${state.username}</div>
        <button id="join">Join Quiz</button>
        <button id="logout">Logout</button>
    `
    document.getElementById("join").onclick = joinQuiz
    document.getElementById("logout").onclick = () => {
        state = {session_id:null, username:null, phone:null, token:null, expiry:0}
        loginScreen()
    }
}

function joinQuiz() {
    clear()
    app.innerHTML = `
        <div style="font-size:20px;">Enter 6-digit quiz code and 12-char code</div>
        <input id="six" placeholder="6-digit code">
        <input id="twelve" placeholder="12-char access code">
        <button id="joinBtn">Join</button>
        <button id="back">Back</button>
        <div id="msg" style="margin-top:12px;font-size:18px;"></div>
    `
    document.getElementById("back").onclick = home
    document.getElementById("joinBtn").onclick = async () => {
        let six = document.getElementById("six").value.trim()
        let access = document.getElementById("twelve").value.trim()
        if (!six || !access) {
            document.getElementById("msg").innerText = "Enter both codes"
            return
        }
        let payload = {
            username: state.username,
            phone: state.phone,
            quiz_code: six,
            access_code: access
        }
        try {
            let r = await fetch(SERVER + "/register", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify(payload)
            })
            if (r.status == 200) {
                let d = await r.json()
                state.session_id = d.session_id
                c = six
                quiz()
                return
            }
            let d = await r.json().catch(()=>({}))
            document.getElementById("msg").innerText = d.error || "Join failed"
        } catch(e){
            document.getElementById("msg").innerText = "Error connecting to server"
        }
    }
}

async function quiz() {
    clear()
    app.innerHTML = `
        <div id="q" style="font-size:22px;">Getting question...</div>
        <input id="answer" placeholder="Type answer">
        <button id="submit">Submit</button>
        <div id="timer" style="margin-top:12px;font-size:18px;"></div>
        <div id="status" style="margin-top:12px;font-size:18px;"></div>
    `
    getQuestion()
}

async function getQuestion() {
    try {
        let r = await fetch(SERVER + "/get_question", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({session_id: state.session_id})
        })
        if (r.status != 200) {
            document.getElementById("status").innerText = "Error fetching question"
            return
        }
        let d = await r.json()
        if (d.done) {
            document.getElementById("status").innerText = "Quiz finished!"
            setTimeout(home, 1500)
            return
        }
        let q = d.question || {}
        state.token = d.token
        state.expiry = d.exp
        document.getElementById("q").innerText = q.text || "No text"
        let answerInput = document.getElementById("answer")
        let submitBtn = document.getElementById("submit")
        answerInput.disabled = false
        submitBtn.disabled = false
        stopTimer = false
        countdown(Math.floor(state.expiry - Date.now()/1000))
        submitBtn.onclick = submitAnswer
    } catch(e) {
        document.getElementById("status").innerText = "Error fetching question"
    }
}

async function submitAnswer() {
    let ans = document.getElementById("answer").value.trim()
    if (!ans) ans = "WRONG"
    stopTimer = true
    const input = document.getElementById("answer")
    input.disabled = true
    document.getElementById("submit").disabled = true
    let payload = {session_id: state.session_id, answer: ans, token: state.token}
    try {
        let r = await fetch(SERVER + "/submit_answer", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        })
        if (r.status != 200) {
            let d = await r.json().catch(()=>({}))
            document.getElementById("status").innerText = d.error || "Submit failed"
            return
        }
        let d = await r.json()
        if (d.done) {
            document.getElementById("status").innerText = "Quiz finished!"
            setTimeout(home, 1500)
            return
        }
        document.getElementById("status").innerText = "Answer recorded"
        input.value = ""  // <-- reset input box here
        setTimeout(getQuestion, 1200)
    } catch(e) {
        document.getElementById("status").innerText = "Error submitting answer"
    }
}


function countdown(sec) {
    let lbl = document.getElementById("timer")
    let answer = document.getElementById("answer")
    let submit = document.getElementById("submit")
    let t = setInterval(() => {
        if (stopTimer) {
            clearInterval(t)
            return
        }
        if (sec <= 0) {
            lbl.innerText = "Time's up!"
            answer.disabled = true
            submit.disabled = true
            clearInterval(t)
            autoWrong()
            return
        }
        lbl.innerText = "Time left: " + sec + "s"
        sec--
    }, 1000)
}

async function autoWrong() {
    let payload = {session_id: state.session_id, answer: "WRONG", token: state.token}
    try {
        let r = await fetch(SERVER + "/submit_answer", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        })
        let d = await r.json()
        if (d.done) {
            document.getElementById("status").innerText = "Quiz finished!"
            setTimeout(home,1500)
            return
        }
        setTimeout(getQuestion, 800)
    } catch(e) {
        document.getElementById("status").innerText = "Error submitting WRONG"
    }
}

document.onvisibilitychange = () => {
    if (document.visibilityState === "visible") {
        foc++
        fetch(SERVER+"/ping", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({username:state.username, code:c})
        })
        if (foc >= 2) home()
    }
}

loginScreen()


