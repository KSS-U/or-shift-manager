(() => {
  "use strict";

  if (document.getElementById("photoView")) return;

  const staff = [...data.staff];
  const codes = ["D", "C", "BC", "외", "off", "V", "HV", "HD"];

  let imageFile = null;
  let detectedWords = [];
  let dateColumns = [];
  let detectedRows = [];
  let previewRows = [];
  let month = "";
  let lastDay = 0;

  const clean = value =>
    String(value || "")
      .replace(/[^a-zA-Z가-힣0-9]/g, "")
      .toLowerCase();

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const pad = n => String(n).padStart(2, "0");

  function setStatus(message) {
    document.getElementById("photoStatus").textContent = message;
  }

  function addInterface() {
    const tabs = document.querySelector(".tabs");
    const app = document.querySelector(".app");

    if (!tabs || !app) {
      alert("앱 화면을 찾지 못했습니다.");
      return;
    }

    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = "사진 등록";
    tab.dataset.view = "photoView";
    tabs.appendChild(tab);

    const view = document.createElement("section");
    view.className = "view";
    view.id = "photoView";

    view.innerHTML = `
      <div class="card" style="padding:14px;">
        <h3 style="margin-top:0;">근무표 사진 등록</h3>

        <label>근무표 월</label>
        <input type="month" id="photoMonth"
          value="${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}"
          style="width:100%;margin:6px 0 12px;">

        <label>근무표 사진 선택</label>
        <input type="file" id="photoFile"
          accept="image/*" style="width:100%;margin:6px 0 12px;">

        <img id="photoImage"
          style="display:none;width:100%;max-height:300px;object-fit:contain;border-radius:8px;margin:8px 0;">

        <button type="button" id="photoRead" class="primary"
          style="width:100%;margin-top:8px;">
          사진 읽기
        </button>

        <div id="photoStatus"
          style="white-space:pre-line;margin-top:12px;font-size:13px;">
          월을 선택하고 근무표 사진을 등록해 주세요.
        </div>
      </div>

      <div class="card" id="photoMappingCard"
        style="display:none;padding:14px;margin-top:12px;">
        <h3 style="margin-top:0;">직원 행 확인</h3>
        <p style="font-size:13px;">
          사진에서 찾은 직원 행을 등록된 직원과 연결해 주세요.
          사진에 없는 직원이나 추가 직원은 선택하지 않아도 됩니다.
        </p>
        <div id="photoMappings"></div>
      </div>

      <div class="card" id="photoPreviewCard"
        style="display:none;padding:14px;margin-top:12px;">
        <h3 style="margin-top:0;">근무표 미리보기</h3>
        <p style="font-size:12px;">
          각 칸의 근무코드를 눌러 수정할 수 있습니다.
          빈칸과 판독되지 않은 코드는 off로 표시됩니다.
        </p>

        <div style="overflow-x:auto;">
          <table id="photoTable"
            style="border-collapse:collapse;min-width:100%;font-size:11px;">
          </table>
        </div>

        <button type="button" id="photoSave"
          class="primary" style="width:100%;margin-top:14px;">
          확인 후 근무표 저장
        </button>
      </div>

      <details style="margin:12px 0;padding:10px;">
        <summary>OCR 인식 결과 확인</summary>
        <textarea id="photoText" rows="8" readonly
          style="width:100%;margin-top:8px;font-size:11px;"></textarea>
      </details>
    `;

    app.appendChild(view);

    tab.addEventListener("click", () => {
      document.querySelectorAll(".view").forEach(el =>
        el.classList.toggle("active", el.id === "photoView")
      );

      tabs.querySelectorAll("button").forEach(el =>
        el.classList.toggle("active", el === tab)
      );
    });

    document.getElementById("photoFile").addEventListener("change", event => {
      imageFile = event.target.files?.[0] || null;

      const img = document.getElementById("photoImage");

      if (imageFile) {
        img.src = URL.createObjectURL(imageFile);
        img.style.display = "block";
        setStatus("사진이 등록되었습니다. 사진 읽기를 눌러 주세요.");
      } else {
        img.style.display = "none";
      }

      document.getElementById("photoMappingCard").style.display = "none";
      document.getElementById("photoPreviewCard").style.display = "none";
    });

    document.getElementById("photoRead").addEventListener("click", readPhoto);
    document.getElementById("photoSave").addEventListener("click", savePhoto);
  }

  function loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("OCR 프로그램을 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }

  function groupByY(words, tolerance = 20) {
    const groups = [];

    [...words]
      .sort((a, b) => a.y - b.y)
      .forEach(word => {
        let group = groups.find(g => Math.abs(g.y - word.y) < tolerance);

        if (!group) {
          group = { y: word.y, words: [] };
          groups.push(group);
        }

        group.words.push(word);
        group.y = group.words.reduce((sum, w) => sum + w.y, 0) /
          group.words.length;
      });

    groups.forEach(group => {
      group.words.sort((a, b) => a.x - b.x);
      group.text = group.words.map(w => w.text).join("");
    });

    return groups.sort((a, b) => a.y - b.y);
  }

  function findDateColumns(words) {
    const numberWords = words.map(w => {
      const value = String(w.text || "").replace(/[^\d]/g, "");

      return {
        day: Number(value),
        x: w.x,
        y: w.y
      };
    }).filter(w =>
      Number.isInteger(w.day) &&
      w.day >= 1 &&
      w.day <= lastDay
    );

    const groups = groupByY(numberWords, 35)
      .map(group => ({
        y: group.y,
        items: group.words
      }))
      .sort((a, b) => {
        const countA = new Set(a.items.map(w => w.day)).size;
        const countB = new Set(b.items.map(w => w.day)).size;
        return countB - countA;
      });

    const header = groups[0];

    if (!header || new Set(header.items.map(w => w.day)).size < 3) {
      return null;
    }

    const unique = [];

    header.items.forEach(w => {
      if (!unique.some(v => v.day === w.day)) unique.push(w);
    });

    if (unique.length < 3) return null;

    // 날짜와 가로 위치의 관계를 직선으로 계산
    const meanDay = unique.reduce((s, w) => s + w.day, 0) / unique.length;
    const meanX = unique.reduce((s, w) => s + w.x, 0) / unique.length;

    let numerator = 0;
    let denominator = 0;

    unique.forEach(w => {
      numerator += (w.day - meanDay) * (w.x - meanX);
      denominator += (w.day - meanDay) ** 2;
    });

    const pitch = numerator / denominator;
    const startX = meanX - pitch * meanDay;

    if (!Number.isFinite(pitch) || pitch < 3) return null;

    return Array.from({ length: lastDay }, (_, i) => ({
      day: i + 1,
      x: startX + pitch * (i + 1)
    }));
  }

  function findStaffRows(words) {
    const firstDateX = dateColumns[0]?.x;
    const pitch = dateColumns[1]?.x - firstDateX;

    if (!Number.isFinite(firstDateX) || !Number.isFinite(pitch)) {
      return [];
    }

    // 날짜 첫 열보다 왼쪽에 있는 글자를 직원 이름 영역으로 간주
    const leftWords = words.filter(w =>
      w.x < firstDateX - pitch * 0.35 &&
      w.y > 40
    );

    const lines = groupByY(leftWords, 24);

    return lines
      .filter(line => line.words.length > 0)
      .map((line, index) => {
        const text = line.text;
        const exact = staff.find(name => clean(text).includes(clean(name)));

        return {
          id: index,
          y: line.y,
          text,
          name: exact || "",
          words: line.words
        };
      })
      .filter(row => row.y > 50);
  }

  function renderMappings() {
    const card = document.getElementById("photoMappingCard");
    const el = document.getElementById("photoMappings");

    card.style.display = "block";

    if (!detectedRows.length) {
      el.innerHTML = `
        <p style="color:#d9534f;">
          직원 이름 영역을 읽지 못했습니다.
          이 사진으로는 직원별 근무표를 안전하게 만들 수 없습니다.
        </p>`;
      document.getElementById("photoPreviewCard").style.display = "none";
      return;
    }

    el.innerHTML = detectedRows.map(row => `
      <div style="display:flex;align-items:center;gap:8px;
        padding:7px 0;border-bottom:1px solid #ddd;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;">
            ${escapeHTML(row.text || "(이름 인식 안 됨)")}
          </div>
          <div style="font-size:10px;color:#888;">
            사진의 ${row.id + 1}번째 인식 행
          </div>
        </div>
        <select data-row="${row.id}"
          style="width:115px;max-width:42%;">
          <option value="">선택 안 함</option>
          ${staff.map(name => `
            <option value="${escapeHTML(name)}"
              ${row.name === name ? "selected" : ""}>
              ${escapeHTML(name)}
            </option>
          `).join("")}
        </select>
      </div>
    `).join("");

    el.querySelectorAll("select[data-row]").forEach(select => {
      select.addEventListener("change", () => {
        const row = detectedRows[Number(select.dataset.row)];
        row.name = select.value;
        buildPreview();
      });
    });

    buildPreview();
  }

  function getCode(value) {
    const raw = String(value || "").trim();
    const upper = raw.toUpperCase();

    if (raw.includes("예비군")) return "off";

    const match = upper.match(/BC|HV|HD|OFF|[DCV]/);
    if (match) {
      const code = match[0] === "OFF" ? "off" : match[0];
      return codes.includes(code) ? code : "off";
    }

    if (raw.includes("외")) return "외";

    return "off";
  }

  function buildPreview() {
    const mapped = detectedRows.filter(row =>
      row.name && staff.includes(row.name)
    );

    const uniqueNames = new Set(mapped.map(row => row.name));

    if (!mapped.length) {
      document.getElementById("photoPreviewCard").style.display = "none";
      return;
    }

    const pitch = dateColumns.length > 1
      ? dateColumns[1].x - dateColumns[0].x
      : 20;

    const sortedY = mapped.map(r => r.y).sort((a, b) => a - b);
    const gaps = sortedY.slice(1).map((y, i) => y - sortedY[i]);
    const rowGap = gaps.length
      ? gaps.reduce((a, b) => a + b, 0) / gaps.length
      : 30;

    const yTolerance = Math.max(12, Math.min(28, rowGap * 0.48));

    previewRows = [];

    mapped.forEach(row => {
      const dayCodes = {};

      for (let day = 1; day <= lastDay; day++) {
        dayCodes[day] = "off";
      }

      // 해당 직원 행과 가까운 위치에 있는 OCR 단어를 날짜별로 배치
      detectedWords.forEach(word => {
        if (Math.abs(word.y - row.y) > yTolerance) return;

        const nearest = dateColumns.reduce((best, col) =>
          Math.abs(col.x - word.x) < Math.abs(best.x - word.x)
            ? col
            : best
        );

        if (Math.abs(nearest.x - word.x) > pitch * 0.48) return;

        const token = String(word.text || "").trim();
        const code = getCode(token);

        if (
          /BC|HV|HD|OFF|[DCV]|외|예비군/i.test(token)
        ) {
          dayCodes[nearest.day] = code;
        }
      });

      previewRows.push({
        name: row.name,
        days: dayCodes
      });
    });

    // 같은 직원이 두 행에 연결된 경우 중복 방지
    const seen = new Set();
    previewRows = previewRows.filter(row => {
      if (seen.has(row.name)) return false;
      seen.add(row.name);
      return true;
    });

    renderPreview();

    const missing = staff.filter(name =>
      !previewRows.some(row => row.name === name)
    );

    setStatus(
      `날짜 ${lastDay}일을 기준으로 미리보기를 만들었습니다.\n` +
      `직원 ${previewRows.length}명 연결됨.\n` +
      (missing.length
        ? `직원 연결이 안 된 사람: ${missing.join(", ")}\n`
        : "") +
      `미리보기에서 코드를 확인한 후 저장해 주세요.`
    );
  }

  function renderPreview() {
    const card = document.getElementById("photoPreviewCard");
    const table = document.getElementById("photoTable");

    card.style.display = "block";

    let html = `
      <thead>
        <tr>
          <th style="position:sticky;left:0;background:#eee;padding:5px;">
            직원
          </th>
          ${Array.from({ length: lastDay }, (_, i) => `
            <th style="padding:4px;background:#eee;">${i + 1}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
    `;

    previewRows.forEach((row, rowIndex) => {
      html += `
        <tr>
          <th style="position:sticky;left:0;background:#fff;
            padding:4px;white-space:nowrap;border:1px solid #ddd;">
            ${escapeHTML(row.name)}
          </th>
      `;

      for (let day = 1; day <= lastDay; day++) {
        html += `
          <td style="padding:2px;border:1px solid #ddd;">
            <select data-person="${rowIndex}" data-day="${day}"
              style="width:38px;min-width:38px;padding:3px 0;
                font-size:10px;border:0;background:transparent;">
              ${codes.map(code => `
                <option value="${code}"
                  ${row.days[day] === code ? "selected" : ""}>
                  ${code}
                </option>
              `).join("")}
            </select>
          </td>
        `;
      }

      html += "</tr>";
    });

    html += "</tbody>";
    table.innerHTML = html;

    table.querySelectorAll("select[data-person]").forEach(select => {
      select.addEventListener("change", () => {
        const row = previewRows[Number(select.dataset.person)];
        const day = Number(select.dataset.day);
        row.days[day] = select.value;
      });
    });
  }

  async function readPhoto() {
    const monthInput = document.getElementById("photoMonth");

    if (!imageFile) {
      alert("먼저 근무표 사진을 선택해 주세요.");
      return;
    }

    month = monthInput.value;

    if (!month) {
      alert("근무표 월을 선택해 주세요.");
      return;
    }

    lastDay = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate();

    document.getElementById("photoRead").disabled = true;
    document.getElementById("photoMappingCard").style.display = "none";
    document.getElementById("photoPreviewCard").style.display = "none";

    try {
      setStatus("사진을 분석하고 있습니다. 잠시 기다려 주세요.");

      await loadTesseract();

      const result = await Tesseract.recognize(
        imageFile,
        "kor+eng",
        {
          logger: info => {
            if (info.status === "recognizing text") {
              setStatus(
                `사진을 읽고 있습니다. ${Math.round((info.progress || 0) * 100)}%`
              );
            }
          }
        }
      );

      const ocr = result.data || {};
      document.getElementById("photoText").value = ocr.text || "";

      detectedWords = (ocr.words || []).map(word => ({
        text: word.text || "",
        x: (word.bbox.x0 + word.bbox.x1) / 2,
        y: (word.bbox.y0 + word.bbox.y1) / 2,
        confidence: word.confidence || 0
      })).filter(word => word.text.trim());

      if (!detectedWords.length) {
        setStatus("글자를 인식하지 못했습니다. 사진을 확인해 주세요.");
        return;
      }

      dateColumns = findDateColumns(detectedWords);

      if (!dateColumns) {
        setStatus(
          "날짜 열의 위치를 계산하지 못했습니다.\n" +
          "날짜를 충분히 읽지 못해 잘못된 근무표가 만들어지는 것을 막았습니다."
        );
        return;
      }

      detectedRows = findStaffRows(detectedWords);

      renderMappings();

      if (!detectedRows.length) {
        setStatus(
          "날짜 열은 찾았지만 직원 이름 행을 찾지 못했습니다.\n" +
          "직원별 근무표를 안전하게 만들 수 없어 저장을 막았습니다."
        );
      }
    } catch (error) {
      console.error(error);
      setStatus("사진 읽기 중 오류가 발생했습니다.\n" + error.message);
    } finally {
      document.getElementById("photoRead").disabled = false;
    }
  }

  function savePhoto() {
    if (!previewRows.length) {
      alert("저장할 직원이 없습니다. 직원 행을 먼저 연결해 주세요.");
      return;
    }

    const total = previewRows.length * lastDay;
    let existing = 0;

    previewRows.forEach(row => {
      for (let day = 1; day <= lastDay; day++) {
        const date = `${month}-${pad(day)}`;
        if (data.shifts[key(date, row.name)] !== undefined) {
          existing++;
        }
      }
    });

    const message =
      `${month} 근무표를 저장할까요?\n\n` +
      `직원: ${previewRows.length}명\n` +
      `날짜: 1일~${lastDay}일\n` +
      `저장할 근무칸: ${total}개\n` +
      `기존 근무 기록 덮어쓰기: ${existing}개\n\n` +
      `미리보기에서 확인한 내용으로 저장합니다.`;

    if (!confirm(message)) return;

    previewRows.forEach(row => {
      for (let day = 1; day <= lastDay; day++) {
        const date = `${month}-${pad(day)}`;
        const code = codes.includes(row.days[day])
          ? row.days[day]
          : "off";

        data.shifts[key(date, row.name)] = code;
      }
    });

    save();

    alert("근무표 저장이 완료되었습니다.");
  }

  addInterface();
})();
