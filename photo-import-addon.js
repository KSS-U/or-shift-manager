
(() => {
  const tab = document.querySelector(".tabs");
  const app = document.querySelector(".app");

  if (!tab || !app || document.getElementById("photoView")) return;

  // 사진 등록 탭
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
      <p class="hint">
        등록된 직원의 근무표를 사진으로 읽어옵니다.
      </p>

      <label>근무표 월 선택</label>
      <input type="month" id="photoMonth" style="width:100%">

      <label style="margin-top:12px">근무표 사진 선택</label>
      <input type="file" id="photoFile"
        accept="image/*" style="width:100%">

      <div id="photoPreview" style="margin-top:12px"></div>

      <button class="primary" id="photoRead"
        style="width:100%;margin-top:12px">
        사진 글자 읽기
      </button>

      <p id="photoStatus" class="hint"></p>

      <label>인식된 원문</label>
      <textarea id="photoText" rows="6"
        style="width:100%"></textarea>
    </div>

    <div class="card">
      <h3>인식된 근무 미리보기</h3>
      <p class="hint">
        빈칸과 미등록 근무코드는 off로 표시됩니다.
        저장 전에 반드시 사진과 비교해 주세요.
      </p>

      <div id="photoSummary" class="hint"></div>
      <div id="photoRows"></div>

      <button class="primary" id="photoSave"
        style="width:100%;margin-top:12px" disabled>
        확인한 근무 저장
      </button>
    </div>
  `;

  app.appendChild(view);

  // 탭 전환
  btn.onclick = () => {
    document.querySelectorAll(".tabs button").forEach(b =>
      b.classList.toggle("active", b === btn)
    );

    ["calendar", "table", "week", "people", "photo"].forEach(id => {
      const el = document.getElementById(id + "View");
      if (el) el.classList.toggle("hidden", id !== "photo");
    });
  };

  const now = new Date();

  document.getElementById("photoMonth").value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let rows = [];
  let previewUrl = null;

  const fileInput = document.getElementById("photoFile");
  const monthInput = document.getElementById("photoMonth");
  const status = document.getElementById("photoStatus");
  const textArea = document.getElementById("photoText");
  const preview = document.getElementById("photoPreview");
  const saveButton = document.getElementById("photoSave");

  const clean = value =>
    String(value || "")
      .replace(/[^a-zA-Z가-힣]/g, "")
      .toLowerCase();

  // 사진 선택
  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    previewUrl = URL.createObjectURL(file);

    preview.innerHTML =
      `<img src="${previewUrl}"
        style="max-width:100%;border-radius:12px">`;

    status.textContent = "사진이 선택되었습니다.";
    textArea.value = "";

    rows = [];
    renderRows();
  };

  // 월 변경 시 이전 미리보기 초기화
  monthInput.onchange = () => {
    rows = [];
    renderRows();
    status.textContent = "새로운 근무표를 읽어주세요.";
  };

  // 사진 글자 읽기
  document.getElementById("photoRead").onclick = async () => {
    const file = fileInput.files[0];
    const month = monthInput.value;

    if (!file) return alert("먼저 사진을 선택해 주세요.");
    if (!month) return alert("근무표 월을 선택해 주세요.");

    rows = [];
    renderRows();

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
        status.textContent =
          "글자를 읽지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.";
        return;
      }

      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();

      // 날짜 숫자 찾기
      
      const dateWords = words.map(w => {
        const raw = String(w.text || "").trim();
        const value = raw.replace(/[^0-9]/g, "");

        return {
          day: value ? Number(value) : NaN,
          x: (w.bbox.x0 + w.bbox.x1) / 2,
          y: (w.bbox.y0 + w.bbox.y1) / 2
        };
      }).filter(w =>
        Number.isInteger(w.day) &&
        w.day >= 1 &&
        w.day <= lastDay
      );
            console.log("인식된 날짜 숫자:", dateWords);
      status.textContent =
        `날짜 숫자 ${dateWords.length}개 인식됨: ` +
        dateWords.map(w => w.day).join(", ");

        Number.isInteger(w.day) &&
        w.day >= 1 &&
        w.day <= lastDay
      );

      // 날짜가 있는 가로줄 찾기
      
      const clusters = [];

      dateWords.sort((a, b) => a.y - b.y).forEach(w => {
        let group = clusters.find(g =>
          Math.abs(g.y - w.y) < 40
        );

        if (!group) {
          group = { y: w.y, items: [] };
          clusters.push(group);
        }

        group.items.push(w);

        group.y =
          group.items.reduce((sum, item) => sum + item.y, 0) /
          group.items.length;
      });

      clusters.sort((a, b) =>
        new Set(b.items.map(w => w.day)).size -
        new Set(a.items.map(w => w.day)).size
      );

      const header = clusters[0];

      
      if (!header || header.items.length < 2) {
        status.textContent = "날짜 행을 찾지 못했습니다. 사진을 확인해 주세요.";
        return;
      }

      const columns = [];

      header.items
        .sort((a, b) => a.x - b.x)
        .forEach(w => {
          if (
            w.day >= 1 &&
            w.day <= lastDay &&
            !columns.some(c => c.day === w.day)
          ) {
            columns.push(w);
          }
        });

      if (columns.length < 2) {
        status.textContent = "날짜 숫자를 충분히 인식하지 못했습니다.";
        return;
      }


      header.items
        .sort((a, b) => a.x - b.x)
        .forEach(w => {
          if (!columns.some(c => c.day === w.day)) {
            columns.push(w);
          }
        });

      // 날짜가 빠졌으면 저장 방지
      const detectedDays = new Set(columns.map(c => c.day));

      const missingDays = [];

      for (let day = 1; day <= lastDay; day++) {
        if (!detectedDays.has(day)) missingDays.push(day);
      }

      if (missingDays.length) {
        status.textContent =
          `날짜 ${missingDays.join(", ")}일을 찾지 못했습니다. 사진을 확인해 주세요.`;
        return;
      }

      // 앱에 등록된 직원 이름만 찾기
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

      // 등록된 직원 이름을 모두 찾지 못하면 저장하지 않음
      const missingStaff = staff.filter(name =>
        !staffRows.some(s => s.name === name)
      );

      if (missingStaff.length) {
        status.textContent =
          `직원 이름을 찾지 못했습니다: ${missingStaff.join(", ")}. 사진을 더 선명하게 준비해 주세요.`;
        return;
      }

      // 날짜 열 간격 계산
      const gaps = columns.slice(1)
        .map((c, i) => c.x - columns[i].x)
        .filter(n => n > 0);

      const spacing = gaps.length
        ? Math.min(...gaps)
        : 100;

      // 인식된 근무코드 저장
      const codeMap = new Map();

      words.forEach(w => {
        const raw = String(w.text || "").trim();
        const code = clean(raw).toUpperCase();

        const x = (w.bbox.x0 + w.bbox.x1) / 2;
        const y = (w.bbox.y0 + w.bbox.y1) / 2;

        const nearest = staffRows
          .map(s => ({
            staff: s,
            distance: Math.abs(s.y - y)
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        if (!nearest || nearest.distance > 25) return;
        if (x <= nearest.staff.x) return;

        const column = columns.reduce((best, c) =>
          Math.abs(c.x - x) < Math.abs(best.x - x)
            ? c : best
        );

        if (Math.abs(column.x - x) > spacing * 0.65) return;

        let normalized = "";

        if (raw.includes("예비군")) {
          normalized = "off";
        } else if (
          ["D", "C", "BC", "외", "V", "HV", "HD"].includes(code)
        ) {
          normalized = code;
        } else if (code === "OFF") {
          normalized = "off";
        }

        if (normalized) {
          codeMap.set(
            `${nearest.staff.name}_${column.day}`,
            normalized
          );
        }
      });

      // 모든 직원 × 모든 날짜 생성
      // 인식되지 않은 코드와 빈칸은 off
      rows = [];

      staff.forEach(name => {
        for (let day = 1; day <= lastDay; day++) {
          const code =
            codeMap.get(`${name}_${day}`) || "off";

          rows.push({
            date: `${month}-${String(day).padStart(2, "0")}`,
            name,
            code,
            use: true
          });
        }
      });

      rows.sort((a, b) =>
        a.date.localeCompare(b.date) ||
        staff.indexOf(a.name) - staff.indexOf(b.name)
      );

      renderRows();

      const offCount = rows.filter(r => r.code === "off").length;

      status.textContent =
        `읽기 완료! ${rows.length}개 항목을 만들었습니다. 사진과 꼭 비교해 주세요.`;

      document.getElementById("photoSummary").textContent =
        `직원 ${staff.length}명 · ${lastDay}일 · 전체 ${rows.length}개 · off ${offCount}개`;

    } catch (err) {
      console.error(err);

      status.textContent =
        "읽기에 실패했습니다. 인터넷 연결과 사진을 확인하고 다시 시도해 주세요.";
    }
  };

  // 미리보기 표시
  function renderRows() {
    const area = document.getElementById("photoRows");
    const summary = document.getElementById("photoSummary");

    if (!rows.length) {
      area.innerHTML =
        '<p class="empty">인식된 근무가 없습니다.</p>';

      summary.textContent = "";
      saveButton.disabled = true;
      return;
    }

    area.innerHTML = rows.map((r, i) => `
      <div style="
        display:flex;
        gap:5px;
        align-items:center;
        padding:7px 0;
        border-bottom:1px solid #eee;
        flex-wrap:wrap">

        <input type="checkbox"
          data-use="${i}"
          ${r.use ? "checked" : ""}>

        <input type="date"
          data-date="${i}"
          value="${r.date}"
          style="flex:1;min-width:135px">

        <select data-code="${i}">
          ${CODES.map(c => `
            <option value="${c}"
              ${c === r.code ? "selected" : ""}>
              ${c}
            </option>
          `).join("")}
        </select>

        <span style="font-size:12px">${r.name}</span>
      </div>
    `).join("");

    area.querySelectorAll("[data-use]").forEach(el => {
      el.onchange = () => {
        rows[+el.dataset.use].use = el.checked;
      };
    });

    area.querySelectorAll("[data-date]").forEach(el => {
      el.onchange = () => {
        rows[+el.dataset.date].date = el.value;
      };
    });

    area.querySelectorAll("[data-code]").forEach(el => {
      el.onchange = () => {
        rows[+el.dataset.code].code = el.value;
      };
    });

    saveButton.disabled = false;
  }

  // 저장
  saveButton.onclick = () => {
    const selected = rows.filter(r => r.use && r.date);

    if (!selected.length) {
      return alert("저장할 근무를 선택해 주세요.");
    }

    const message =
      `${selected.length}개 근무를 저장할까요?\n\n` +
      "기존 같은 날짜와 직원의 근무는 변경됩니다.\n" +
      "빈칸과 인식되지 않은 근무는 off로 저장됩니다.";

    if (!confirm(message)) return;

    selected.forEach(r => {
      data.shifts[key(r.date, r.name)] = r.code;
    });

    save();

    alert("근무가 저장되었습니다.");

    rows = [];
    renderRows();
    status.textContent = "저장이 완료되었습니다.";
  };
})();
