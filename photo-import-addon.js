
(() => {
  if (document.getElementById("photoView")) return;

  const tabs = document.querySelector(".tabs");
  const app = document.querySelector(".app");
  if (!tabs || !app) {
    alert("앱 화면을 찾지 못했습니다.");
    return;
  }

  const tab = document.createElement("button");
  tab.textContent = "사진 등록";
  tab.dataset.view = "photoView";
  tabs.appendChild(tab);

  const view = document.createElement("section");
  view.id = "photoView";
  view.className = "view";
  view.innerHTML = `
    <div class="card">
      <h3>사진으로 근무표 등록</h3>
      <p>엑셀 근무표 캡처 이미지를 선택해 주세요.</p>
      <input id="photoFile" type="file" accept="image/*">
      <p style="margin-top:12px">등록할 연월</p>
      <input id="photoMonth" type="month" style="padding:9px">
    </div>

    <div class="card">
      <h3>표 영역 맞추기</h3>
      <p style="font-size:13px">
        아래 숫자를 조정해 날짜 칸과 직원별 근무 영역을 맞춰 주세요.
        미리보기의 선을 기준으로 조정하면 됩니다.
      </p>
      <div id="photoPreviewWrap">
        <canvas id="photoCanvas" style="width:100%;height:auto;border:1px solid #ddd"></canvas>
      </div>
      <div id="photoControls" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <button id="readPhotoBtn" class="primary" style="width:100%">
        근무표 읽기
      </button>
      <p id="photoStatus" style="font-size:13px"></p>
    </div>

    <div class="card" id="photoResult" style="display:none">
      <h3>인식 결과 미리보기</h3>
      <p style="font-size:13px">
        저장 전에 직원별 근무를 확인해 주세요.
        인식하지 못한 칸은 off로 표시됩니다.
      </p>
      <div id="photoTable" style="overflow-x:auto"></div>
      <button id="savePhotoBtn" class="primary" style="width:100%;margin-top:14px">
        확인 후 저장
      </button>
    </div>
  `;
  app.appendChild(view);

  tab.addEventListener("click", () => {
    document.querySelectorAll(".view").forEach(v => v.style.display = "none");
    view.style.display = "block";
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    tab.classList.add("active");
  });

  const $ = id => document.getElementById(id);
  let photo = null;
  let results = [];
  let worker = null;

  const settings = {
    dateStart: 20,
    right: 98,
    staffTop: 28,
    staffBottom: 96
  };

  const controls = [
    ["dateStart", "첫 날짜 칸의 왼쪽 위치"],
    ["right", "마지막 날짜 칸의 오른쪽 위치"],
    ["staffTop", "첫 직원 근무칸의 위쪽 위치"],
    ["staffBottom", "마지막 직원 근무칸의 아래쪽 위치"]
  ];

  $("photoControls").innerHTML = controls.map(([id, label]) => `
    <div style="margin:12px 0">
      <label for="range_${id}" style="display:block;font-weight:600">
        ${label}: <span id="value_${id}">${settings[id]}%</span>
      </label>
      <input id="range_${id}" type="range" min="0" max="100" value="${settings[id]}" style="width:100%">
    </div>
  `).join("");

  controls.forEach(([id]) => {
    $("range_" + id).addEventListener("input", e => {
      settings[id] = Number(e.target.value);
      $("value_" + id).textContent = settings[id] + "%";
      drawPreview();
    });
  });

  function drawPreview() {
    if (!photo) return;
    const canvas = $("photoCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = photo.naturalWidth;
    canvas.height = photo.naturalHeight;
    ctx.drawImage(photo, 0, 0);

    const w = canvas.width;
    const h = canvas.height;
    const x1 = w * settings.dateStart / 100;
    const x2 = w * settings.right / 100;
    const y1 = h * settings.staffTop / 100;
    const y2 = h * settings.staffBottom / 100;

    ctx.save();
    ctx.strokeStyle = "#e53935";
    ctx.lineWidth = Math.max(2, w / 700);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    const month = $("photoMonth").value;
    const days = month ? new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate() : 31;

    ctx.strokeStyle = "#1976d2";
    for (let i = 1; i < days; i++) {
      const x = x1 + (x2 - x1) * i / days;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }

    ctx.strokeStyle = "#16a05d";
    for (let i = 1; i < 6; i++) {
      const y = y1 + (y2 - y1) * i / 6;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  $("photoFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    photo = new Image();
    photo.onload = () => {
      drawPreview();
      $("photoStatus").textContent = "사진을 불러왔습니다. 빨간 영역과 칸 구분선을 맞춰 주세요.";
      $("photoResult").style.display = "none";
    };
    photo.onerror = () => alert("사진을 불러오지 못했습니다.");
    photo.src = URL.createObjectURL(file);
  });

  $("photoMonth").addEventListener("change", drawPreview);

  
function getCode(raw) {
  const t = String(raw || "")
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[^A-Z가-힣]/g, "");

  const candidates = [
    ["BC", ["BC", "8C", "BС"]],
    ["HV", ["HV", "HⅤ"]],
    ["HD", ["HD", "H0"]],
    ["off", ["OFF", "0FF", "OF"]],
    ["외", ["외", "외근"]],
    ["D", ["D", "0", "O"]],
    ["C", ["C", "G"]],
    ["V", ["V", "Y"]]
  ];

  for (const [code, variants] of candidates) {
    if (variants.some(v => t === v || t.includes(v))) {
      return code;
    }
  }

  return "확인";
}

async function readOneCell(x, y, width, height) {
  const scale = 4;
  const c = document.createElement("canvas");

  c.width = 240 * scale;
  c.height = 120 * scale;

  const ctx = c.getContext("2d", { willReadFrequently: true });

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    photo,
    x, y, width, height,
    12, 12, c.width - 24, c.height - 24
  );

  const image = ctx.getImageData(0, 0, c.width, c.height);
  const pixels = image.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const gray =
      pixels[i] * 0.299 +
      pixels[i + 1] * 0.587 +
      pixels[i + 2] * 0.114;

    const contrast = Math.max(
      0,
      Math.min(255, (gray - 145) * 2.2 + 128)
    );

    pixels[i] = contrast;
    pixels[i + 1] = contrast;
    pixels[i + 2] = contrast;
  }

  ctx.putImageData(image, 0, 0);

  const result = await worker.recognize(c);
  const raw = result.data.text || "";
  const code = getCode(raw);

  return {
    code,
    raw,
    confidence: Number(result.data.confidence || 0)
  };
}


  $("readPhotoBtn").addEventListener("click", async () => {
    const month = $("photoMonth").value;
    if (!photo) {
      alert("먼저 근무표 사진을 선택해 주세요.");
      return;
    }
    if (!month) {
      alert("등록할 연월을 선택해 주세요.");
      return;
    }
    if (!Array.isArray(data.staff) || data.staff.length !== 6) {
      alert("현재 등록된 직원이 6명인지 확인해 주세요.");
      return;
    }

    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const days = new Date(year, mon, 0).getDate();

    const x1 = photo.naturalWidth * settings.dateStart / 100;
    const x2 = photo.naturalWidth * settings.right / 100;
    const y1 = photo.naturalHeight * settings.staffTop / 100;
    const y2 = photo.naturalHeight * settings.staffBottom / 100;

    if (x2 <= x1 || y2 <= y1) {
      alert("표 영역 위치를 다시 조정해 주세요.");
      return;
    }

    $("readPhotoBtn").disabled = true;
    $("photoStatus").textContent = "OCR 준비 중입니다. 잠시 기다려 주세요.";

    try {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (!worker) {
        worker = await Tesseract.createWorker("kor+eng");
      }

      results = [];
      for (let r = 0; r < 6; r++) {
        const staffName = data.staff[r];
        const rowTop = y1 + (y2 - y1) * r / 6;
        const rowBottom = y1 + (y2 - y1) * (r + 1) / 6;
        
        const row = [];
        const uncertain = [];
        const rawTexts = [];

        for (let d = 1; d <= days; d++) {
          const colLeft = x1 + (x2 - x1) * (d - 1) / days;
          const colRight = x1 + (x2 - x1) * d / days;

          const marginX = (colRight - colLeft) * 0.12;
          const marginY = (rowBottom - rowTop) * 0.12;

          $("photoStatus").textContent =
            `${staffName} · ${d}/${days}일 인식 중...`;

          const result = await readOneCell(
            colLeft + marginX,
            rowTop + marginY,
            colRight - colLeft - marginX * 2,
            rowBottom - rowTop - marginY * 2
          );

          row.push(result.code);
          rawTexts.push(result.raw);

          if (result.code === "확인" || result.confidence < 65) {
            uncertain.push(d - 1);
          }
        }

        results.push({
          name: staffName,
          codes: row,
          uncertain,
          rawTexts
        });
      }


      renderResults(year, mon, days);
      $("photoStatus").textContent = "인식이 끝났습니다. 결과를 확인해 주세요.";
      $("photoResult").style.display = "block";
    } catch (err) {
      console.error(err);
      alert("사진 인식 중 오류가 발생했습니다: " + (err.message || err));
      $("photoStatus").textContent = "인식에 실패했습니다.";
    } finally {
      $("readPhotoBtn").disabled = false;
    }
  });

  
function renderResults(year, mon, days) {
  let html = `<table style="border-collapse:collapse;white-space:nowrap;font-size:12px">
    <tr><th style="padding:6px;border:1px solid #ccc">직원</th>`;

  for (let d = 1; d <= days; d++) {
    html += `<th style="padding:5px;border:1px solid #ccc">${d}</th>`;
  }
  html += "</tr>";

  results.forEach((row, r) => {
    html += `<tr><th style="padding:6px;border:1px solid #ccc">${row.name}</th>`;

    row.codes.forEach((code, d) => {
      const isUncertain = row.uncertain.includes(d);
      const raw = row.rawTexts[d] || "";
      const shownCode = isUncertain ? "확인" : code;

      html += `
        <td style="
          padding:5px;
          border:1px solid #ccc;
          background:${isUncertain ? "#ffe0e0" : "#fff"};
        ">
          <select
            data-row="${r}"
            data-day="${d}"
            style="font-size:12px;${isUncertain ? "border:2px solid #e53935;" : ""}"
          >
            ${["D","C","BC","외","off","V","HV","HD","확인"].map(c =>
              `<option value="${c}" ${c === shownCode ? "selected" : ""}>${c}</option>`
            ).join("")}
          </select>
          <div style="font-size:9px;color:#777;max-width:55px;overflow:hidden">
            원문: ${String(raw).replace(/[&<>"']/g, "")}
          </div>
          ${isUncertain ? '<div style="font-size:10px;color:#d32f2f;font-weight:bold">확인 필요</div>' : ""}
        </td>`;
    });

    html += "</tr>";
  });

  html += "</table>";
  $("photoTable").innerHTML = html;

  $("photoTable").querySelectorAll("select").forEach(select => {
    select.addEventListener("change", () => {
      const r = Number(select.dataset.row);
      const d = Number(select.dataset.day);
      results[r].codes[d] = select.value;

      if (select.value !== "확인") {
        results[r].uncertain = results[r].uncertain.filter(i => i !== d);
        select.parentElement.style.background = "#fff";
        select.style.border = "";
        const warning = select.parentElement.querySelector("div:last-child");
        if (warning && warning.textContent === "확인 필요") {
          warning.remove();
        }
      }
    });
  });
}


  $("savePhotoBtn").addEventListener("click", () => {
    
    const hasUncertain = results.some(row =>
      row.codes.includes("확인") ||
      row.uncertain.length > 0
    );

    if (hasUncertain) {
      alert("아직 확인하지 않은 근무코드가 있습니다. 빨간색 칸을 모두 확인해 주세요.");
      return;
    }

    if (!results.length) return;

    const month = $("photoMonth").value;
    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const days = new Date(year, mon, 0).getDate();

    let overwrite = 0;
    results.forEach(row => {
      row.codes.forEach((code, i) => {
        const date = `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        if (data.shifts[key(date, row.name)] !== undefined) overwrite++;
      });
    });

    if (!confirm(
      `기존 근무 기록 ${overwrite}건을 덮어쓸 수 있습니다.\n` +
      `${results.length}명, ${days}일 근무표를 저장할까요?`
    )) return;

    results.forEach(row => {
      row.codes.forEach((code, i) => {
        const date = `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        data.shifts[key(date, row.name)] = code;
      });
    });

    save();
    alert("근무표 저장이 완료되었습니다.");
    $("photoResult").style.display = "none";
  });

})();
