
/* ─── DOM references ─── */
const links          = document.querySelectorAll(".nav-items a");
const pageLinks      = document.querySelectorAll("[data-page-link]");
const pages          = document.querySelectorAll(".content-section");
const logo           = document.querySelector(".logo");
const container      = document.querySelector(".container");
const leftPanel      = document.querySelector(".left");
const rightPanel     = document.querySelector(".right");
const themeSlides    = document.querySelectorAll(".theme-slide");
const slideDots      = document.querySelectorAll(".slide-dot");
const slideCount     = document.querySelector("#slide-count");
const fileInput      = document.querySelector("#submission-files");
const dropZone       = document.querySelector("#drop-zone");
const fileList       = document.querySelector("#file-list");
const uploadForm     = document.querySelector("#submission-form");
const uploadButton   = document.querySelector("#upload-button");
const uploadStatus   = document.querySelector("#upload-status");
// Paste the deployed Google Apps Script Web App URL here.
const uploadEndpoint = "https://script.google.com/macros/s/AKfycbz0xrzGItOOvvCj4iwfRRG-OalfIU0FbHpp4WP8sVb6c3m0bBSJBt1v0835SyHXJYo/exec";
const isUploadConfigured =
    /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(uploadEndpoint);

/* ─── State ─── */
let currentSlide   = 0;
let selectedFiles  = [];
let isTransitioning = false;
const allowedExtensions = new Set(["doc","docx","pdf","txt","rtf","jpg","jpeg","png"]);
const maxFileSize = 20 * 1024 * 1024;

/* ─────────────────────────────────────────────
   PAGE MAPPING — alternating left / right
   ─────────────────────────────────────────────
   home   → default split (no full-screen panel)
   theme  → LEFT  (green panel expands →)
   submit → RIGHT (cream panel expands ←)
   about  → LEFT  (green panel expands →)
   ───────────────────────────────────────────── */
const PAGE_SIDE = {
    home   : "split",   // stays as split, no expansion
    theme  : "left",    // green expands to fill screen
    about  : "left",    // green expands to fill screen
    submit : "right",   // cream expands to fill screen
};

/* ─────────────────────────────────────────────
   SHOW PAGE (content swap only, no animation)
   ───────────────────────────────────────────── */
function showPage(pageName) {
    pages.forEach(page => {
        const active = page.dataset.page === pageName;
        page.hidden = !active;
        page.classList.toggle("is-active", active);
    });
}

/* ─────────────────────────────────────────────
   UPDATE PAGE STATE
   Applies the correct panel class and updates
   active link highlight.
   ───────────────────────────────────────────── */
function updatePageState(pageName) {
    const side = PAGE_SIDE[pageName] ?? "left";

    container.classList.remove("show-left", "show-right");

    if (side === "left")  container.classList.add("show-left");
    if (side === "right") container.classList.add("show-right");
    // "split" → no class added → panels return to 50/50

    showPage(pageName);

    links.forEach(link => {
        link.classList.toggle("active", link.dataset.pageLink === pageName);
    });
}

/* ─────────────────────────────────────────────
   WAIT FOR PANEL SLIDE TO FINISH
   Resolves when the CSS transition on the
   incoming panel ends (or after a timeout).
   ───────────────────────────────────────────── */
function waitForSlide(panel) {
    const style = getComputedStyle(panel);
    // transitionDuration may list multiple values (transform, width…)
    const durations = style.transitionDuration.split(",").map(d =>
        d.trim().endsWith("ms") ? parseFloat(d) : parseFloat(d) * 1000
    );
    const maxDuration = Math.max(...durations, 0);

    return new Promise(resolve => {
        const timeout = setTimeout(finish, maxDuration + 80);

        function finish() {
            clearTimeout(timeout);
            panel.removeEventListener("transitionend", onEnd);
            resolve();
        }

        function onEnd(e) {
            if (e.target === panel && (e.propertyName === "transform" || e.propertyName === "width")) finish();
        }

        panel.addEventListener("transitionend", onEnd);
        if (maxDuration <= 0) finish();
    });
}

/* ─────────────────────────────────────────────
   NAVIGATE TO PAGE
   The incoming side's panel slides to cover the
   whole screen; the outgoing panel is pushed out.
   Content swaps once the screen is covered.
   Then the panels animate back to the split.

   WAIT — re-reading the spec: the user wants the
   panel to stay covering the full screen (not
   return to split) while on that page. The split
   only exists on the home / default state.

   So the flow is:
     1. Add show-left / show-right to .container
        → CSS transitions animate the panels
     2. Mid-way through, swap content
     3. Done — panels stay at their new position
   ───────────────────────────────────────────── */
async function navigateTo(pageName) {
    if (isTransitioning) return;

    const validPage = Array.from(pages).some(p => p.dataset.page === pageName);
    if (!validPage) return;

    const currentActive = document.querySelector(".content-section.is-active");
    if (currentActive?.dataset.page === pageName) return;

    isTransitioning = true;

    const side         = PAGE_SIDE[pageName] ?? "left";
    const incomingPanel = side === "left" ? leftPanel : rightPanel;

    try {
        // Apply the new panel state — CSS transitions handle the rest
        updatePageState(pageName);
        // Wait for the incoming panel's slide to complete
        await waitForSlide(incomingPanel);
    } finally {
        isTransitioning = false;
    }
}

/* ─── Nav link clicks ─── */
pageLinks.forEach(link => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        navigateTo(this.dataset.pageLink);
    });
});

/* ─── Logo → home ─── */
logo.addEventListener("click", () => navigateTo("home"));
logo.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateTo("home");
    }
});

/* ─────────────────────────────────────────────
   THEME SLIDES (unchanged)
   ───────────────────────────────────────────── */
function showSlide(index) {
    currentSlide = (index + themeSlides.length) % themeSlides.length;
    themeSlides.forEach((slide, i) => {
        const active = i === currentSlide;
        slide.hidden = !active;
        slide.classList.toggle("is-current", active);
    });
    slideDots.forEach((dot, i) => {
        const active = i === currentSlide;
        dot.classList.toggle("is-current", active);
        if (active) dot.setAttribute("aria-current", "true");
        else        dot.removeAttribute("aria-current");
    });
    slideCount.textContent =
        `${String(currentSlide + 1).padStart(2, "0")} / ${String(themeSlides.length).padStart(2, "0")}`;
}

document.querySelectorAll("[data-slide-direction]").forEach(btn => {
    btn.addEventListener("click", () =>
        showSlide(currentSlide + Number(btn.dataset.slideDirection))
    );
});

slideDots.forEach(dot => {
    dot.addEventListener("click", () => showSlide(Number(dot.dataset.slideTo)));
});

/* ─────────────────────────────────────────────
   FILE UPLOAD (unchanged)
   ───────────────────────────────────────────── */
function updateUploadState(message, state) {
    uploadStatus.textContent = message;
    uploadStatus.dataset.state = state || "";
}

function validateSelectedFiles() {
    if (selectedFiles.length > 0) {
        fileInput.setCustomValidity("");
        return true;
    }

    fileInput.setCustomValidity("Please select one or more files.");
    return false;
}

function renderSelectedFiles() {
    fileList.replaceChildren();

    selectedFiles.forEach(file => {
        const item = document.createElement("li");
        item.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        fileList.append(item);
    });

    const hasName = uploadForm.elements.authorName.value.trim().length > 0;
    uploadButton.disabled =
        selectedFiles.length === 0 || !hasName || !isUploadConfigured;

    uploadButton.firstChild.textContent = isUploadConfigured
        ? "Send to magazine "
        : "Connect Google Drive first ";

    validateSelectedFiles();
}

function addFiles(files) {
    const validFiles = [];
    const rejectedFiles = [];

    Array.from(files).forEach(file => {
        const ext = file.name.split(".").pop().toLowerCase();

        if (!allowedExtensions.has(ext) || file.size > maxFileSize) {
            rejectedFiles.push(file.name);
        } else {
            validFiles.push(file);
        }
    });

    selectedFiles = [...selectedFiles, ...validFiles];
    renderSelectedFiles();

    if (rejectedFiles.length > 0) {
        updateUploadState(
            `Not added (unsupported format or over 20 MB): ${rejectedFiles.join(", ")}`,
            "error"
        );
    } else if (validFiles.length > 0) {
        updateUploadState(
            isUploadConfigured
                ? "Files ready. They will be saved to the magazine Google Drive folder."
                : "Files selected. Add your Apps Script Web App URL in script.js to enable uploads.",
            ""
        );
    }
}

/* Convert one file to base64 for the Apps Script endpoint. */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || "");
            const comma = result.indexOf(",");

            if (comma < 0) {
                reject(new Error(`Could not read ${file.name}.`));
                return;
            }

            resolve(result.slice(comma + 1));
        };

        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
    });
}

/*
 * Apps Script web apps do not provide ordinary CORS access to fetch().
 * This posts URL-encoded data to a hidden iframe and receives the result
 * through postMessage from the Apps Script HTML response.
 */
function postToAppsScript(payload) {
    return new Promise((resolve, reject) => {
        const tokenBytes = new Uint8Array(16);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(tokenBytes, byte =>
            byte.toString(16).padStart(2, "0")
        ).join("");

        payload.token = token;

        const frameName = `geck-upload-${token}`;
        const iframe = document.createElement("iframe");
        iframe.name = frameName;
        iframe.hidden = true;
        iframe.setAttribute("title", "Google Drive upload response");

        const form = document.createElement("form");
        form.method = "POST";
        form.action = uploadEndpoint;
        form.enctype = "application/x-www-form-urlencoded";
        form.target = frameName;
        form.hidden = true;

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "payload";
        input.value = JSON.stringify(payload);
        form.append(input);

        const tokenInput = document.createElement("input");
        tokenInput.type = "hidden";
        tokenInput.name = "uploadToken";
        tokenInput.value = token;
        form.append(tokenInput);

        let finished = false;

        const cleanup = () => {
            window.removeEventListener("message", onMessage);
            clearTimeout(timeout);
            form.remove();
            iframe.remove();
        };

        const finish = (callback, value) => {
            if (finished) return;
            finished = true;
            cleanup();
            callback(value);
        };

        const onMessage = event => {
            const data = event.data;

            if (
                !data ||
                data.type !== "GECK_MAGAZINE_UPLOAD" ||
                data.token !== token
            ) {
                return;
            }

            if (data.ok) {
                finish(resolve, data);
            } else {
                finish(reject, new Error(data.message || "Google Drive upload failed."));
            }
        };

        const timeout = setTimeout(() => {
            finish(
                reject,
                new Error("No response from Google Apps Script. Check the deployment URL and try again.")
            );
        }, 120000);

        window.addEventListener("message", onMessage);
        document.body.append(iframe, form);
        form.submit();
    });
}
fileInput.addEventListener("change", e => {
    addFiles(e.target.files);
    fileInput.value = "";
    validateSelectedFiles();
});

uploadForm.elements.authorName.addEventListener("input", renderSelectedFiles);
fileInput.addEventListener("invalid", () => {
    updateUploadState("Please select one or more files.", "error");
});

["dragenter", "dragover"].forEach(evt => {
    dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.add("is-dragging");
    });
});

["dragleave", "drop"].forEach(evt => {
    dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.remove("is-dragging");
    });
});

dropZone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

uploadForm.addEventListener("submit", async e => {
    e.preventDefault();

    if (!isUploadConfigured) {
        updateUploadState(
            "Google Drive is not connected yet. Add your deployed Apps Script URL in script.js.",
            "error"
        );
        return;
    }

    const authorName = uploadForm.elements.authorName.value.trim();
    const title = uploadForm.elements.title.value.trim();

    if (!authorName) {
        updateUploadState(
            "Add your name before submitting.",
            "error"
        );
        uploadForm.elements.authorName.focus();
        return;
    }

    if (!validateSelectedFiles()) {
        fileInput.reportValidity();
        updateUploadState(
            "Please select one or more files.",
            "error"
        );
        return;
    }

    const filesToUpload = [...selectedFiles];
    const uploadedFiles = [];

    uploadButton.disabled = true;
    uploadButton.firstChild.textContent = "Sending... ";
    updateUploadState("Preparing your submission...", "");

    try {
        for (let index = 0; index < filesToUpload.length; index++) {
            const file = filesToUpload[index];

            updateUploadState(
                `Uploading ${index + 1} of ${filesToUpload.length}: ${file.name}`,
                ""
            );

            const base64 = await fileToBase64(file);

            const result = await postToAppsScript({
                authorName,
                title,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                fileSize: file.size,
                base64
            });

            uploadedFiles.push(file);
            selectedFiles = selectedFiles.filter(item => !uploadedFiles.includes(item));
            renderSelectedFiles();

            updateUploadState(
                `Saved ${index + 1} of ${filesToUpload.length} file(s) to Google Drive.`,
                ""
            );
        }

        uploadForm.reset();
        selectedFiles = [];
        renderSelectedFiles();

        updateUploadState(
            `Thank you, ${authorName}. Your ${uploadedFiles.length} file(s) were saved to the magazine Google Drive folder.`,
            "success"
        );
    } catch (err) {
        updateUploadState(
            `Upload stopped. ${err.message} ${uploadedFiles.length} file(s) were saved successfully; remaining files are still selected.`,
            "error"
        );
        renderSelectedFiles();
    }
});

renderSelectedFiles();
