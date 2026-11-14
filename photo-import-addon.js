(() => {
  const tab = document.querySelector(".tabs");
  const app = document.querySelector(".app");

  if (!tab || !app || document.getElementById("photoView")) return;

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
      <p class="hint">직원별 근무표 사진을 읽어 등록합니다.</p>
      <label>근무표 월 선택</label>
      <input type="month" id="photoMonth" style="width:100%">
      <label style="margin-top:12px">근무표 사진 선택</label>
      <input type="file" id="photoFile" accept="image/*" style="width:100%">
      <div id="photoPreview" style="margin-top:12px"></div>
      <button class="primary" id="photoRead" style="width:100%;margin-top:12px">
        사진 글자 읽기
      </button>
      <p id="photoStatus" class="hint"></p>
      <label>인식된 원문</label>
      <textarea id="photoText" rows="6" style="width:100%"></textarea>
    </div>
    <div class="card">
      <h3>인식된 근무 미리보기</h3>
      <p class="hint">날짜와 근무코드를 확인하고 저장하세요.</p>
      <div id="photoRows"></div>
      <button class="primary" id="photoSave"
        style="width:100%;margin-top:12px" disabled>
        확인한 근무 저장
      </button>
    </div>
  `;

  app.appendChild(view);

  btn.onclick = () => {
    document.querySelectorAll(".tabs button").forEach(b =>
      b.classList.toggle("active", b === btn)
    );

    ["calendar", "table", "week", "people"].forEach(id => {
      const el = document.getElementById(id + "View");
      if (el) el.classList.add("hidden");
    });

    view.classList.remove("hidden");
  };

  const now = new Date();
  document.getElementById("photoMonth").value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let rows = [];

  const fileInput = document.getElementById("photoFile");
  const status = document.getElementById("photoStatus");
  const textArea = document.getElementById("photoText");

  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    document.getElementById("photoPreview").innerHTML =
      `<img src="${url}" style="max-width:100%;border-radius:12px">`;

    status.textContent = "사진이 선택되었습니다.";
    rows = [];
    renderRows();
  };

  document.getElementById("photoRead").onclick = async () => {
    const file = fileInput.files[0];
    if (!file) return alert("먼저 사진을 선택해 주세요.");

    const month = document.getElementById("photoMonth").value;
    if (!month) return alert("근무표 월을 선택해 주세요.");

    status.textContent = "글자를 읽는 중입니다. 잠시 기다려 주세요.";

    try {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const result = await Tesseract.recognize(file, "kor+eng");
      const ocr = result.data;
      textArea.value = ocr.text || "";

      const words = ocr.words || [];

      if (!words.length) {
        status.textContent = "글자는 읽었지만 위치 정보를 찾지 못했습니다.";
        return;
      }

      const clean = value =>
        String(value || "").replace(/[^a-zA-Z가-힣]/g, "").toLowerCase();

      const dateWords = words.map(w => {
        const value = clean(w.text);
        return {
          day: Number(value),
          x: (w.bbox.x0 + w.bbox.x1) / 2,
          y: (w.bbox.y0 + w.bbox.y1) / 2
        };
      }).filter(w =>
        Number.isInteger(w.day) && w.day >= 1 && w.day <= 31
      );

      // 날짜 숫자들이 모여 있는 가로줄 찾기
      const clusters = [];

      dateWords.sort((a, b) => a.y - b.y).forEach(w => {
        let group = clusters.find(g =>
          Math.abs(g.y - w.y) < 16
        );

        if (!group) {
          group = { y: w.y, items: [] };
          clusters.push(group);
        }

        group.items.push(w);
        group.y = group.items.reduce((sum, item) => sum + item.y, 0)
          / group.items.length;
      });

      clusters.sort((a, b) =>
        new Set(b.items.map(w => w.day)).size -
        new Set(a.items.map(w => w.day)).size
      );

      const header = clusters[0];
      if (!header || new Set(header.items.map(w => w.day)).size < 2) {
        status.textContent =
          "날짜 열을 찾지 못했습니다. 사진의 날짜 행을 확인해 주세요.";
        return;
      }

      const columns = header.items
        .sort((a, b) => a.x - b.x)
        .filter((w, i, arr) =>
          arr.findIndex(x => x.day === w.day) === i
        );

      const staff = data.staff;
      const staffRows = [];

      staff.forEach(name => {
        const target = clean(name);

        const found = words.find(w =>
          clean(w.text).includes(target)
        );

        if (found) {
          staffRows.push({
            name,
            x: (found.bbox.x0 + found.bbox.x1) / 2,
            y: (found.bbox.y0 + found.bbox.y1) / 2
          });
        }
      });

      if (!staffRows.length) {
        status.textContent =
          "직원 이름을 찾지 못했습니다. 원문을 확인해 주세요.";
        return;
      }

      const codeMap = new Map();

      words.forEach(w => {
        const code = clean(w.text).toUpperCase();
        if (!["D", "C", "BC", "외", "OFF", "V", "HV", "HD"].includes(code)) {
          return;
        }

        const x = (w.bbox.x0 + w.bbox.x1) / 2;
        const y = (w.bbox.y0 + w.bbox.y1) / 2;

        // 가장 가까운 직원 행 찾기
        const nearest = staffRows
          .map(s => ({
            staff: s,
            distance: Math.abs(s.y - y)
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        if (!nearest) return;

        const staffIndex = staffRows.indexOf(nearest.staff);
        const otherDistances = staffRows
          .filter((s, i) => i !== staffIndex)
          .map(s => Math.abs(s.y - nearest.staff.y));

        const limit = otherDistances.length
          ? Math.min(30, Math.max(12, Math.min(...otherDistances) / 2))
          : 24;

        if (nearest.distance > limit) return;
        if (x <= nearest.staff.x) return;

        // 가장 가까운 날짜 열 찾기
        const column = columns.reduce((best, current) =>
          Math.abs(current.x - x) < Math.abs(best.x - x)
            ? current : best
        );

        const spacing = columns.length > 1
          ? Math.min(
              ...columns.slice(1).map((c, i) => c.x - columns[i].x)
            )
          : 100;

        if (Math.abs(column.x - x) > spacing * 0.65) return;

        const normalized = code === "OFF" ? "off" :
          code === "외" ? "외" : code;

        const keyValue = `${nearest.staff.name}_${column.day}`;
        codeMap.set(keyValue, {
          name: nearest.staff.name,
          day: column.day,
          code: normalized
        });
      });

      rows = [];

      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();

      codeMap.forEach(item => {
        if (item.day > lastDay) return;

        rows.push({
          date: `${month}-${String(item.day).padStart(2, "0")}`,
          name: item.name,
          code: item.code,
          use: true
        });
      });

      rows.sort((a, b) =>
        a.date.localeCompare(b.date) ||
        staff.indexOf(a.name) - staff.indexOf(b.name)
      );

      renderRows();

      status.textContent = rows.length
        ? `읽기 완료! ${rows.length}개 항목을 찾았습니다. 반드시 사진과 대조해 주세요.`
        : "글자는 읽었지만 근무코드를 찾지 못했습니다. 원문을 확인해 주세요.";

    } catch (err) {
      console.error(err);
      status.textContent =
        "읽기에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    }
  };

  function renderRows() {
    const area = document.getElementById("photoRows");
    const saveButton = document.getElementById("photoSave");

    if (!rows.length) {
      area.innerHTML =
        '<p class="empty">인식된 근무가 없습니다.</p>';
      saveButton.disabled = true;
      return;
    }

    area.innerHTML = rows.map((r, i) => `
      <div style="display:flex;gap:5px;align-items:center;
        padding:7px 0;border-bottom:1px solid #eee;flex-wrap:wrap">
        <input type="checkbox" data-use="${i}" ${r.use ? "checked" : ""}>
        <input type="date" data-date="${i}" value="${r.date}"
          style="flex:1;min-width:135px">
        <select data-code="${i}">
          ${CODES.map(c =>
            `<option value="${c}" ${c === r.code ? "selected" : ""}>${c}</option>`
          ).join("")}
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

    saveButton.disabled = false;
  }

  document.getElementById("photoSave").onclick = () => {
    const selected = rows.filter(r => r.use && r.date);

    if (!selected.length) {
      return alert("저장할 근무를 선택해 주세요.");
    }

    if (!confirm(
      `${selected.length}개 근무를 저장할까요?\n기존 같은 날짜의 근무는 변경됩니다.`
    )) return;

    selected.forEach(r => {
      data.shifts[key(r.date, r.name)] = r.code;
    });

    save();
    alert("근무가 저장되었습니다.");

    rows = [];
    renderRows();
  };
})();
