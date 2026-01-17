const quotes = [
  {
    text: "Deep work is the superpower of the 21st century.",
    author: "Cal Newport",
  },
  {
    text: "Focus is a matter of deciding what things you're not going to do.",
    author: "John Carmack",
  },
  {
    text: "The successful warrior is the average person, with laser-like focus.",
    author: "Bruce Lee",
  },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "Starve your distractions, feed your focus.", author: "Unknown" },
  {
    text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
    author: "Alexander Graham Bell",
  },
  {
    text: "The key to success is to focus on goals, not obstacles.",
    author: "Unknown",
  },
  {
    text: "You can always find a distraction if you're looking for one.",
    author: "Tom Kite",
  },
  {
    text: "Lack of direction, not lack of time, is the problem. We all have 24-hour days.",
    author: "Zig Ziglar",
  },
  {
    text: "It's not that I'm so smart, it's just that I stay with problems longer.",
    author: "Albert Einstein",
  },
  {
    text: "The main thing is to keep the main thing the main thing.",
    author: "Stephen Covey",
  },
  { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
  {
    text: "Simplicity boils down to two steps: Identify the essential. Eliminate the rest.",
    author: "Leo Babauta",
  },
  {
    text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.",
    author: "Buddha",
  },
  {
    text: "The ability to focus is a superpower in an age of constant distraction.",
    author: "Unknown",
  },
  { text: "What you stay focused on will grow.", author: "Roy T. Bennett" },
  {
    text: "Multitasking is the ability to screw everything up simultaneously.",
    author: "Jeremy Clarkson",
  },
  {
    text: "Be like a postage stamp. Stick to one thing until you get there.",
    author: "Josh Billings",
  },
  { text: "Energy flows where attention goes.", author: "Michael Beckwith" },
  {
    text: "One way to boost our willpower is to manage our distractions.",
    author: "Daniel Goleman",
  },
];

// Get blocked URL from query parameter
const urlParams = new URLSearchParams(window.location.search);
const blockedUrl = urlParams.get("url");
let blockedDomain = "this site";

if (blockedUrl) {
  try {
    const url = new URL(blockedUrl);
    blockedDomain = url.hostname.replace("www.", "");
  } catch (e) {
    blockedDomain = blockedUrl;
  }
}

document.getElementById("blockedDomain").textContent = blockedDomain;

// Display random quote
const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
document.getElementById("quote").textContent = `"${randomQuote.text}"`;
document.getElementById("quoteAuthor").textContent = `— ${randomQuote.author}`;

// Update current time
function updateTime() {
  const now = new Date();
  const options = { weekday: "long", hour: "2-digit", minute: "2-digit" };
  document.getElementById("currentTime").textContent = now.toLocaleDateString(
    "en-US",
    options,
  );
}
updateTime();
setInterval(updateTime, 1000);

// Check for active focus session
async function checkSession() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "getTimeRemaining",
    });
    if (response && response.remaining > 0) {
      document.getElementById("sessionInfo").classList.add("active");
      updateSessionTimer(response.remaining);
    }
  } catch (e) {
    // Extension context may not be available
  }
}

function updateSessionTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById("sessionTimer").textContent =
    `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

checkSession();
setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "getTimeRemaining",
    });
    if (response && response.remaining > 0) {
      updateSessionTimer(response.remaining);
    }
  } catch (e) {}
}, 1000);

// Button handlers
document.getElementById("breakBtn").addEventListener("click", async () => {
  const breakUntil = Date.now() + 5 * 60 * 1000; // 5 minutes

  try {
    // Save temporary break to storage
    const result = await chrome.storage.local.get("temporaryBreaks");
    const breaks = result.temporaryBreaks || {};
    breaks[blockedDomain] = breakUntil;
    await chrome.storage.local.set({ temporaryBreaks: breaks });

    document.getElementById("breakNotice").classList.add("active");
    document.getElementById("breakBtn").textContent = "Break activated!";
    document.getElementById("breakBtn").disabled = true;

    // Redirect to the blocked site
    setTimeout(() => {
      if (blockedUrl) {
        window.location.href = blockedUrl;
      }
    }, 1500);
  } catch (e) {
    // Fallback if chrome API not available
    document.getElementById("breakNotice").classList.add("active");
    document.getElementById("breakBtn").textContent = "Break activated!";
  }
});

document.getElementById("backBtn").addEventListener("click", () => {
  window.close();
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  try {
    chrome.runtime.openOptionsPage();
  } catch (e) {
    window.location.href = chrome.runtime.getURL("src/options/index.html");
  }
});
