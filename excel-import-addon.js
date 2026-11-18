(() => {
  if (document.getElementById("autoView")) return;

  const app = document.querySelector(".app");

  if (!app) {
    alert("앱 화면을 찾지 못했습니다.");
    return;
  }

const view = document.createElement("section");
view.id = "autoView";
view.className = "view hidden";
view.dataset.view = "auto";

  view.innerHTML = `
    <div class="card">
      <h3>엑셀 근무표 등록</h3>
      <p>엑셀 파일(.xlsx)을 선택해 주세요.</p>

      <input
        id="excelFile"
        type="file"
        accept=".xlsx"
        style="width:100%;font-size:13px;padding:5px"
      >

      <p style="margin-top:12px">등록할 연월</p>
      <input
        id="excelMonth"
        type="month"
        value="${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}"
        style="padding:7px;font-size:14px"
      >

      <p id="excelStatus" style="font-size:13px;margin-top:10px"></p>
    </div>

    <div class="card" id="excelResult" style="display:none">
      <h3>근무표 미리보기</h3>
      <p style="font-size:13px">
        각 칸을 눌러 근무코드를 수정한 뒤 저장해 주세요.
        빈칸과 미등록 코드는 off로 표시됩니다.
      </p>

      <div id="excelTable" style="overflow-x:auto"></div>

      <button
        id="saveExcelBtn"
        class="primary"
        style="width:100%;margin-top:14px"
      >
        확인 후 저장
      </button>
    </div>
  `;

  app.appendChild(view);

  const $ = id => document.getElementById(id);

  let results = [];
  let selectedFileName = "";

  function normalizeCode(value) {
    const t = String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s/g, "");

    if (["D", "C", "BC", "외", "OFF", "V", "HV", "HD"].includes(t)) {
      return t === "OFF" ? "off" : t;
    }

    if (["외근", "외"].includes(t)) return "외";
    if (t.includes("예비군")) return "off";

    return "off";
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  async function loadXLSX() {
    if (window.XLSX) return;

    $("excelStatus").textContent =
      "엑셀 읽기 기능을 준비하고 있습니다.";

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

      script.onload = resolve;
      script.onerror = () => reject(
        new Error("엑셀 읽기 기능을 불러오지 못했습니다.")
      );

      document.head.appendChild(script);
    });
  }

  function renderExcelPreview() {
    const month = $("excelMonth").value;
    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const days = new Date(year, mon, 0).getDate();

    let html = `
      <table style="
        border-collapse:collapse;
        white-space:nowrap;
        font-size:12px;
        width:100%
      ">
        <tr>
          <th style="padding:7px;border:1px solid #ccc;background:#f3f0f8">
            직원
          </th>
    `;

    for (let d = 1; d <= days; d++) {
      html += `
        <th style="padding:5px;border:1px solid #ccc;background:#f3f0f8">
          ${d}
        </th>
      `;
    }

    html += "</tr>";

    results.forEach((row, r) => {
      html += `
        <tr>
          <th style="padding:6px;border:1px solid #ccc;background:#f8f7fb">
            ${escapeHTML(row.name)}
          </th>
      `;

      row.codes.forEach((code, d) => {
        html += `
          <td style="padding:3px;border:1px solid #ccc;text-align:center">
            <select
              data-row="${r}"
              data-day="${d}"
              style="
                font-size:12px;
                font-weight:700;
                padding:5px 2px;
                border-radius:5px;
              "
            >
              ${["D","C","BC","외","off","V","HV","HD"].map(c => `
                <option value="${c}" ${c === code ? "selected" : ""}>
                  ${c}
                </option>
              `).join("")}
            </select>
          </td>
        `;
      });

      html += "</tr>";
    });

    html += "</table>";

    $("excelTable").innerHTML = html;

    $("excelTable").querySelectorAll("select").forEach(select => {
      select.addEventListener("change", () => {
        const r = Number(select.dataset.row);
        const d = Number(select.dataset.day);

        results[r].codes[d] = select.value;
      });
    });
  }

  $("excelFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    $("excelResult").style.display = "none";
    $("excelStatus").textContent = "엑셀 파일을 읽고 있습니다.";

    try {
      await loadXLSX();

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array"
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw new Error("엑셀 시트를 찾을 수 없습니다.");
      }

      if (!Array.isArray(data.staff) || data.staff.length !== 6) {
        throw new Error("앱에 등록된 직원이 6명인지 확인해 주세요.");
      }

      const excelStaff = [];

      // 엑셀 C13~C18의 직원 이름 확인
      for (let r = 12; r <= 17; r++) {
        const cell = sheet[XLSX.utils.encode_cell({
          r: r,
          c: 2
        })];

        excelStaff.push(
          String(cell?.v ?? "").trim()
        );
      }

      const missing = data.staff.filter(name =>
        !excelStaff.includes(String(name).trim())
      );

      if (missing.length > 0) {
        throw new Error(
          "엑셀에서 다음 직원 이름을 찾지 못했습니다: " +
          missing.join(", ")
        );
      }

      const month = $("excelMonth").value;

      if (!month) {
        throw new Error("등록할 연월을 선택해 주세요.");
      }

      const year = Number(month.slice(0, 4));
      const mon = Number(month.slice(5, 7));
      const days = new Date(year, mon, 0).getDate();

      results = data.staff.map(staffName => {
        const excelRow = excelStaff.indexOf(
          String(staffName).trim()
        ) + 12;

        const codes = [];

        for (let d = 0; d < days; d++) {
          const cell = sheet[XLSX.utils.encode_cell({
            r: excelRow,
            c: 3 + d
          })];

          codes.push(normalizeCode(cell?.v));
        }

        return {
          name: staffName,
          codes
        };
      });

      selectedFileName = file.name;

      renderExcelPreview();

      $("excelResult").style.display = "block";

      $("excelStatus").textContent =
        `${selectedFileName} · ${year}년 ${mon}월 · ` +
        `${results.length}명 · ${days}일 불러오기 완료`;

      $("saveExcelBtn").disabled = false;

    } catch (err) {
      console.error(err);
      $("excelStatus").textContent =
        "엑셀 등록 실패: " + (err.message || err);

      alert("엑셀 파일을 읽지 못했습니다.\n" + (err.message || err));
    }
  });

  $("excelMonth").addEventListener("change", () => {
    if (!results.length) return;

    const month = $("excelMonth").value;
    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const days = new Date(year, mon, 0).getDate();

    results.forEach(row => {
      row.codes = Array.from(
        { length: days },
        (_, i) => row.codes[i] || "off"
      );
    });

    renderExcelPreview();
  });

  $("saveExcelBtn").addEventListener("click", () => {
    if (!results.length) return;

    const month = $("excelMonth").value;
    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const days = new Date(year, mon, 0).getDate();

    let overwrite = 0;

    results.forEach(row => {
      row.codes.forEach((code, i) => {
        const date =
          `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;

        if (data.shifts[key(date, row.name)] !== undefined) {
          overwrite++;
        }
      });
    });

    if (!confirm(
      `기존 근무 기록 ${overwrite}건을 덮어쓸 수 있습니다.\n` +
      `${results.length}명, ${days}일 근무표를 저장할까요?`
    )) return;

    results.forEach(row => {
      row.codes.forEach((code, i) => {
        const date =
          `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;

        data.shifts[key(date, row.name)] = code;
      });
    });

    save();

    alert("엑셀 근무표 저장이 완료되었습니다.");

    $("excelResult").style.display = "none";
    $("excelStatus").textContent = "저장이 완료되었습니다.";
    $("excelFile").value = "";
    results = [];
  });

})();
