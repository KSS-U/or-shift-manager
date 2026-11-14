(() => {
  const tab = document.querySelector(".tabs");
  if (!tab || document.getElementById("photoView")) return;

  const btn = document.createElement("button");
  btn.textContent = "사진 등록";
  btn.dataset.view = "photo";
  tab.appendChild(btn);

  const view = document.createElement("section");
  view.id = "photoView";
  view.className = "hidden";
  view.innerHTML = `
    <div class="card">
      <h2>근무표 사진 등록</h2>
      <p class="hint">근무표 사진을 선택하면 글자를 읽어 근무 입력 초안을 만듭니다.</p>
      <label>근무표 월 선택</label>
      <input type="month" id="photoMonth" style="width:100%">
      <label style="margin-top:12px">근무표 사진 선택</label>
      <input type="file" id="photoFile" accept="image/*" style="width:100%">
      <div id="photoPreview" style="margin-top:12px"></div>
      <button class="primary" id="photoRead" style="width:100%;margin-top:12px">사진 글자 읽기</button>
      <p id="photoStatus" class="hint"></p>
      <label>읽은 내용</label>
      <textarea id="photoText" rows="6" style="width:100%"></textarea>
    </div>
    <div class="card">
      <h3>인식된 근무 미리보기</h3>
      <p class="hint">날짜와 근무코드를 꼭 확인한 뒤 저장하세요.</p>
      <div id="photoRows"></div>
      <button class="primary" id="photoSave" style="width:100%;margin-top:12px" disabled>확인한 근무 저장</button>
    </div>
  `;
  document.querySelector(".app").appendChild(view);

  btn.onclick = () => {
    document.querySelectorAll(".tabs button").forEach(b =>
      b.classList.toggle("active", b === btn)
    );
    ["calendar","table","week","people"].forEach(id => {
      document.getElementById(id + "View").classList.add("hidden");
    });
    view.classList.remove("hidden");
  };

  document.getElementById("photoMonth").value =
    new Date().toISOString().slice(0,7);

  let rows = [];

  document.getElementById("photoFile").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.getElementById("photoPreview").innerHTML =
      `<img src="${url}" style="max-width:100%;border-radius:12px">`;
    document.getElementById("photoStatus").textContent = "사진이 선택되었습니다.";
  };

  document.getElementById("photoRead").onclick = async () => {
    const file = document.getElementById("photoFile").files[0];
    if (!file) return alert("먼저 근무표 사진을 선택해 주세요.");

    const status = document.getElementById("photoStatus");
    status.textContent = "글자를 읽는 중입니다. 잠시 기다려 주세요.";

    try {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const result = await Tesseract.recognize(file, "kor+eng");
      const text = result.data.text || "";
      document.getElementById("photoText").value = text;

      const month = document.getElementById("photoMonth").value;
      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();

      rows = [];
      text.split(/\n/).forEach(line => {
        const name = data.staff.find(n => line.includes(n));
        if (!name) return;

        const rest = line.slice(line.indexOf(name) + name.length);
        const tokens = rest.match(/BC|HV|HD|D|C|외|off|V/gi) || [];

        tokens.slice(0, lastDay).forEach((code, i) => {
          const normalized = CODES.find(c => c.toLowerCase() === code.toLowerCase());
          if (normalized) {
            rows.push({
              date: `${month}-${String(i+1).padStart(2,"0")}`,
              name,
              code: normalized,
              use: true
            });
          }
        });
      });

      renderRows();
      status.textContent = `읽기 완료! ${rows.length}개 항목을 찾았습니다.`;
    } catch (err) {
      status.textContent = "글자 읽기에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    }
  };

  function renderRows() {
    const area = document.getElementById("photoRows");
    if (!rows.length) {
      area.innerHTML = '<p class="empty">인식된 근무가 없습니다. 사진이나 글자 인식 결과를 확인해 주세요.</p>';
      document.getElementById("photoSave").disabled = true;
      return;
    }

    area.innerHTML = rows.map((r,i) => `
      <div style="display:flex;gap:5px;align-items:center;padding:7px 0;border-bottom:1px solid #eee;flex-wrap:wrap">
        <input type="checkbox" data-use="${i}" ${r.use ? "checked" : ""}>
        <input type="date" data-date="${i}" value="${r.date}" style="flex:1;min-width:135px">
        <select data-code="${i}">
          ${CODES.map(c => `<option ${c===r.code?"selected":""}>${c}</option>`).join("")}
        </select>
        <span style="font-size:12px">${r.name}</span>
      </div>
    `).join("");

    area.querySelectorAll("[data-use]").forEach(el =>
      el.onchange = () => rows[+el.dataset.use].use = el.checked
    );
    area.querySelectorAll("[data-date]").forEach(el =>
      el.onchange = () => rows[+el.dataset.date].date = el.value
    );
    area.querySelectorAll("[data-code]").forEach(el =>
      el.onchange = () => rows[+el.dataset.code].code = el.value
    );

    document.getElementById("photoSave").disabled = false;
  }

  document.getElementById("photoSave").onclick = () => {
    const selected = rows.filter(r => r.use && r.date);
    if (!selected.length) return alert("저장할 근무를 선택해 주세요.");
    if (!confirm(`${selected.length}개 근무를 저장할까요?`)) return;

    selected.forEach(r => {
      data.shifts[key(r.date, r.name)] = r.code;
    });

    save();
    alert("근무가 저장되었습니다.");
    rows = [];
    renderRows();
  };
})();
