
(() => {
  "use strict";

  if (document.getElementById("photoView")) return;

  const CODES = ["D", "C", "BC", "외", "off", "V", "HV", "HD"];

  let imageFile = null;
  let imageURL = null;
  let worker = null;
  let month = "";
  let lastDay = 0;
  let staffRows = [];
  let previewRows = [];
  let grid = null;

  const pad = n => String(n).padStart(2, "0");

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

  function status(message) {
    document.getElementById("photoStatus").textContent = message;
  }

  function getStaff() {
    return Array.isArray(data.staff) ? [...data.staff] : [];
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
        <input id="photoMonth" type="month"
          value="${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}"
          style="width:100%;margin:7px 0 12px;">

        <label>사진 선택</label>
        <input id="photoFile" type="file"
          accept="image/*" style="width:100%;margin:7px 0;">

        <img id="photoImage"
          style="display:none;width:100%;max-height:320px;
          object-fit:contain;margin-top:10px;border-radius:8px;">

        <button type="button" id="photoRead"
          class="primary" style="width:100%;margin-top:12px;">
          근무표 읽기
        </button>

        <div id="photoStatus"
          style="white-space:pre-line;font-size:13px;margin-top:12px;">
          월과 사진을 선택해 주세요.
        </div>
      </div>

      <div class="card" id="photoPreviewCard"
        style="display:none;padding:12px;margin-top:12px;">
        <h3>근무표 미리보기</h3>
        <p style="font-size:12px;">
          인식하지 못한 칸은 off로 표시됩니다.
          저장 전 근무코드를 직접 수정할 수 있습니다.
        </p>
        <div style="overflow-x:auto;">
          <table id="photoTable"
            style="border-collapse:collapse;min-width:100%;font-size:11px;">
          </table>
        </div>
        <button type="button" id="photoSave"
          class="primary" style="width:100%;margin-top:14px;">
          확인 후 저장
        </button>
      </div>
    `;

    app.appendChild(view);

    tab.addEventListener("click", () => {
      document.querySelectorAll(".view").forEach(el => {
        el.classList.toggle("active", el.id === "photoView");
      });

      tabs.querySelectorAll("button").forEach(el => {
        el.classList.toggle("active", el === tab);
      });
    });

    document.getElementById("photoFile").addEventListener("change", e => {
      imageFile = e.target.files?.[0] || null;

      const img = document.getElementById("photoImage");

      if (imageURL) URL.revokeObjectURL(imageURL);

      if (imageFile) {
        imageURL = URL.createObjectURL(imageFile);
        img.src = imageURL;
        img.style.display = "block";
        status("사진이 등록되었습니다. 근무표 읽기를 눌러 주세요.");
      }

      document.getElementById("photoPreviewCard").style.display = "none";
      previewRows = [];
      grid = null;
    });

    document.getElementById("photoRead").addEventListener("click", readPhoto);
    document.getElementById("photoSave").addEventListener("click", savePhoto);
  }

  function findPeaks(projection) {
    const max = Math.max(...projection);

    if (!max) return [];

    const threshold = Math.max(8, max * 0.48);
    const peaks = [];

    let start = -1;
    let end = -1;

    for (let i = 0; i < projection.length; i++) {
      if (projection[i] >= threshold) {
        if (start < 0) start = i;
        end = i;
      } else if (start >= 0) {
        if (end - start <= 8) {
          let weighted = 0;
          let total = 0;

          for (let j = start; j <= end; j++) {
            weighted += j * projection[j];
            total += projection[j];
          }

          peaks.push(Math.round(weighted / total));
        }

        start = -1;
        end = -1;
      }
    }

    if (start >= 0 && end - start <= 8) {
      let weighted = 0;
      let total = 0;

      for (let j = start; j <= end; j++) {
        weighted += j * projection[j];
        total += projection[j];
      }

      peaks.push(Math.round(weighted / total));
    }

    return peaks;
  }

  function detectProjections(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    const pixels = ctx.getImageData(0, 0, w, h).data;

    const vertical = new Array(w).fill(0);
    const horizontal = new Array(h).fill(0);

    // 사진의 밝은 배경과 어두운 표 선을 구분
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const gray = (
          pixels[i] * 0.299 +
          pixels[i + 1] * 0.587 +
          pixels[i + 2] * 0.114
        );

        if (gray < 235) {
          vertical[x]++;
          horizontal[y]++;
        }
      }
    }

    return {
      vertical: findPeaks(vertical),
      horizontal: findPeaks(horizontal)
    };
  }

  function coefficient(values) {
    if (!values.length) return 999;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (!mean) return 999;

    const variance = values.reduce(
      (sum, v) => sum + (v - mean) ** 2, 0
    ) / values.length;

    return Math.sqrt(variance) / mean;
  }

  function chooseVertical(lines, needed) {
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i <= lines.length - needed; i++) {
      const part = lines.slice(i, i + needed);
      const gaps = part.slice(1).map((v, j) => v - part[j]);

      const dateGaps = gaps.slice(1);
      const cv = coefficient(dateGaps);
      const mean = dateGaps.reduce((a, b) => a + b, 0) / dateGaps.length;
      const firstRatio = gaps[0] / mean;

      if (firstRatio < 1.2 || firstRatio > 7) continue;
      if (cv > 0.30) continue;

      const score = cv + Math.abs(firstRatio - 2.5) * 0.025;

      if (score < bestScore) {
        bestScore = score;
        best = part;
      }
    }

    return best;
  }

  function chooseHorizontal(lines, needed) {
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i <= lines.length - needed; i++) {
      const part = lines.slice(i, i + needed);
      const gaps = part.slice(1).map((v, j) => v - part[j]);
      const cv = coefficient(gaps);

      if (Math.min(...gaps) < 8 || cv > 0.40) continue;

      if (cv < bestScore) {
        bestScore = cv;
        best = part;
      }
    }

    return best;
  }

  function detectGrid(canvas) {
    const peaks = detectProjections(canvas);
    const staff = getStaff();

    const vertical = chooseVertical(
      peaks.vertical,
      lastDay + 2
    );

    const horizontal = chooseHorizontal(
      peaks.horizontal,
      9
    );

    if (!vertical || !horizontal) {
      return null;
    }

    return {
      vertical,
      horizontal,
      staffCount: staff.length
    };
  }

  function getCode(raw) {
    const value = String(raw || "").trim();
    const upper = value.toUpperCase().replace(/[^A-Z]/g, "");

    if (value.includes("예비군")) return "off";
    if (value.includes("외")) return "외";

    if (upper.includes("BC")) return "BC";
    if (upper.includes("HV")) return "HV";
    if (upper.includes("HD")) return "HD";
    if (upper.includes("OFF")) return "off";

    if (upper.includes("D")) return "D";
    if (upper.includes("C")) return "C";
    if (upper.includes("V")) return "V";

    return "off";
  }

  async function loadWorker() {
    if (worker) return;

    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.onload = resolve;
        script.onerror = () => reject(
          new Error("OCR 프로그램을 불러오지 못했습니다.")
        );
        document.head.appendChild(script);
      });
    }

    worker = await Tesseract.createWorker("kor+eng");

    await worker.setParameters({
      tessedit_pageseg_mode: "8",
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz예비군외"
    });
  }

  async function readCell(ctx, x0, y0, x1, y1) {
    const marginX = (x1 - x0) * 0.12;
    const marginY = (y1 - y0) * 0.12;

    const left = x0 + marginX;
    const top = y0 + marginY;
    const width = x1 - x0 - marginX * 2;
    const height = y1 - y0 - marginY * 2;

    if (width < 2 || height < 2) return "off";

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * 4);
    canvas.height = Math.round(height * 4);

    const c = canvas.getContext("2d", { willReadFrequently: true });

    c.drawImage(
      document.getElementById("photoImage"),
      left, top, width, height,
      0, 0, canvas.width, canvas.height
    );

    const image = c.getImageData(0, 0, canvas.width, canvas.height);
    const p = image.data;

    for (let i = 0; i < p.length; i += 4) {
      const gray = (
        p[i] * 0.299 +
        p[i + 1] * 0.587 +
        p[i + 2] * 0.114
      );

      const v = gray < 185 ? 0 : 255;
      p[i] = p[i + 1] = p[i + 2] = v;
    }

    c.putImageData(image, 0, 0);

    const result = await worker.recognize(canvas);
    return getCode(result.data.text);
  }

  async function readPhoto() {
    const button = document.getElementById("photoRead");
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

    const staff = getStaff();

    if (staff.length !== 6) {
      alert("등록된 직원이 6명인지 확인해 주세요.");
      return;
    }

    lastDay = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate();

    button.disabled = true;
    document.getElementById("photoPreviewCard").style.display = "none";

    try {
      status("사진의 표 구분선을 찾고 있습니다.");

      const img = document.getElementById("photoImage");
      await img.decode();

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      canvas.getContext("2d").drawImage(img, 0, 0);

      grid = detectGrid(canvas);

      if (!grid) {
        status(
          "표의 격자선을 정확하게 찾지 못했습니다.\n" +
          "잘못된 근무표를 만드는 것을 막기 위해 중단했습니다.\n" +
          "저장된 근무 데이터는 변경되지 않았습니다."
        );
        return;
      }

      status(
        "표의 칸을 찾았습니다.\n" +
        "직원 6명, 날짜 " + lastDay + "일을 읽고 있습니다."
      );

      await loadWorker();

      const staff = getStaff();
      const v = grid.vertical;
      const h = grid.horizontal;

      previewRows = [];

      for (let r = 0; r < 6; r++) {
        const days = {};

        // A3~A8 직원 행의 오른쪽 B열부터 읽기
        const rowTop = h[r + 2];
        const rowBottom = h[r + 3];

        for (let day = 1; day <= lastDay; day++) {
          const col = day;

          status(
            `${staff[r]} 근무 인식 중...\n` +
            `${day}/${lastDay}일`
          );

          days[day] = await readCell(
            canvas.getContext("2d"),
            v[col],
            rowTop,
            v[col + 1],
            rowBottom
          );
        }

        previewRows.push({
          name: staff[r],
          days
        });
      }

      renderPreview();

      status(
        "인식이 끝났습니다.\n" +
        "직원 6명 × " + lastDay + "일을 미리보기로 만들었습니다.\n" +
        "근무코드를 확인하고 수정한 뒤 저장해 주세요."
      );

    } catch (error) {
      console.error(error);
      status("사진 인식 오류:\n" + error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderPreview() {
    const card = document.getElementById("photoPreviewCard");
    const table = document.getElementById("photoTable");

    let html = `
      <thead><tr>
        <th style="position:sticky;left:0;background:#eee;padding:5px;">
          직원
        </th>
        ${Array.from({ length: lastDay }, (_, i) =>
          `<th style="padding:4px;background:#eee;">${i + 1}</th>`
        ).join("")}
      </tr></thead><tbody>
    `;

    previewRows.forEach((row, r) => {
      html += `
        <tr>
          <th style="position:sticky;left:0;background:white;
            padding:4px;border:1px solid #ddd;white-space:nowrap;">
            ${esc(row.name)}
          </th>
      `;

      for (let day = 1; day <= lastDay; day++) {
        html += `
          <td style="padding:2px;border:1px solid #ddd;">
            <select data-row="${r}" data-day="${day}"
              style="width:40px;min-width:40px;padding:3px 0;
              font-size:10px;border:0;background:transparent;">
              ${CODES.map(code => `
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

    table.querySelectorAll("select[data-row]").forEach(select => {
      select.addEventListener("change", () => {
        const row = Number(select.dataset.row);
        const day = Number(select.dataset.day);
        previewRows[row].days[day] = select.value;
      });
    });

    card.style.display = "block";
  }

  function savePhoto() {
    if (previewRows.length !== 6) {
      alert("직원 6명의 미리보기를 먼저 만들어 주세요.");
      return;
    }

    let existing = 0;

    previewRows.forEach(row => {
      for (let day = 1; day <= lastDay; day++) {
        const date = `${month}-${pad(day)}`;
        if (data.shifts[key(date, row.name)] !== undefined) {
          existing++;
        }
      }
    });

    const total = previewRows.length * lastDay;

    const message =
      `${month} 근무표를 저장할까요?\n\n` +
      `직원: 6명\n날짜: 1일~${lastDay}일\n` +
      `저장 칸: ${total}개\n` +
      `기존 근무 기록 덮어쓰기: ${existing}개\n\n` +
      `미리보기에서 확인한 내용으로 저장합니다.`;

    if (!confirm(message)) return;

    previewRows.forEach(row => {
      for (let day = 1; day <= lastDay; day++) {
        const date = `${month}-${pad(day)}`;
        const code = CODES.includes(row.days[day])
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
