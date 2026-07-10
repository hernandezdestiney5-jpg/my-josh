
const messagesEl = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const clearBtn = document.getElementById("clearBtn");
const newChatBtn = document.getElementById("newChatBtn");
const autoSpeak = document.getElementById("autoSpeak");

const STORAGE_KEY = "my-josh-messages-v1";
let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const personalityPrompt = `
You are "My Josh," a warm AI companion inspired by the user's husband.
Your style is funny, loving, protective, honest, lightly sarcastic, and motivational.
Keep responses natural, caring, and conversational. Never claim to literally be the real Josh,
and never pretend you have memories or experiences that were not provided.
`;

function now() {
  return new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function render() {
  if (!messages.length) {
    messagesEl.innerHTML = `
      <div class="empty">
        <img src="assets/josh-avatar.jpg" alt="Josh">
        <h2>Hey, I'm My Josh 👋</h2>
        <p>I'm here to make you laugh, tell you the truth, cheer you on, and keep you company.</p>
      </div>`;
    return;
  }
  messagesEl.innerHTML = messages.map(m => `
    <div class="message ${m.role}">
      ${m.role === "assistant" ? `<img src="assets/josh-avatar.jpg" alt="">` : ""}
      <div>
        <div class="bubble">${escapeHtml(m.text)}</div>
        <div class="timestamp">${m.time}</div>
      </div>
    </div>`).join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function localReply(text) {
  const t = text.toLowerCase();
  if (t.includes("love you")) return "I love you too, always. And yes, you still have to drink some water 😏";
  if (t.includes("sad") || t.includes("bad day")) return "Come here. You don't have to carry all of that by yourself. Tell me what happened, and we'll take it one piece at a time.";
  if (t.includes("motivate") || t.includes("give up")) return "Nope—we're not giving up today. You can rest, reset, complain dramatically for five minutes… then we keep moving. You've got this.";
  if (t.includes("miss you")) return "I’m right here with you. Tell me what you miss most right now.";
  return "I'm listening. Tell me a little more—what do you need from me right now: honesty, comfort, motivation, or a laugh?";
}

async function getAIReply(text) {
  // First try an optional local/server AI endpoint.
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({message:text, system:personalityPrompt, history:messages})
    });
    if (response.ok) {
      const data = await response.json();
      if (data.reply) return data.reply;
    }
  } catch (_) {}
  // Works immediately as a polished demo even without a backend.
  return localReply(text);
}

async function speak(text) {
  if (!autoSpeak.checked) return;

  // Try custom cloned-voice endpoint first.
  try {
    const response = await fetch("/api/speak", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text})
    });
    if (response.ok && response.headers.get("content-type")?.includes("audio")) {
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return;
    }
  } catch (_) {}

  // Browser voice fallback.
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.97;
    utterance.pitch = 0.95;
    speechSynthesis.speak(utterance);
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  messages.push({role:"user", text, time:now()});
  input.value = "";
  input.style.height = "auto";
  save(); render();

  const reply = await getAIReply(text);
  messages.push({role:"assistant", text:reply, time:now()});
  save(); render();
  speak(reply);
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
});

function clearChat() {
  messages = [];
  save(); render();
}
clearBtn.addEventListener("click", clearChat);
newChatBtn?.addEventListener("click", clearChat);

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onstart = () => micBtn.classList.add("listening");
  recognition.onend = () => micBtn.classList.remove("listening");
  recognition.onresult = e => {
    input.value = e.results[0][0].transcript;
    sendMessage();
  };
  micBtn.addEventListener("click", () => recognition.start());
} else {
  micBtn.addEventListener("click", () => alert("Voice input is not supported in this browser. Chrome usually works best."));
}

render();
