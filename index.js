const btn = document.getElementById("btn");
const out = document.getElementById("out");

btn.addEventListener("click", async () => {
    const res = await fetch("/api/health"); // gleiche Domain/Port → kein CORS-Problem
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
});