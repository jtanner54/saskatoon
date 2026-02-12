function spawnConfetti() {
  const colors = ["#0072d2", "#00c2ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#a855f7", "#ff8fab"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.left = Math.random() * 100 + "vw";
    el.style.top = (Math.random() * 30 - 10) + "vh";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (Math.random() * 8 + 6) + "px";
    el.style.height = (Math.random() * 8 + 6) + "px";
    el.style.animationDuration = (Math.random() * 1 + 1) + "s";
    el.style.animationDelay = (Math.random() * 0.4) + "s";
    document.body.appendChild(el);
  }
}

document.getElementById("done-btn").addEventListener("click", async () => {
  await browser.storage.local.set({ setupComplete: true });
  spawnConfetti();
  const btn = document.getElementById("done-btn");
  btn.textContent = "All done! Closing...";
  btn.style.background = "#2a8a2a";
  btn.disabled = true;
  setTimeout(() => {
    browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
  }, 1800);
});
