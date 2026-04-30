import { AudioEngine } from "./audio.js";
import { SnakeGame } from "./game.js";
import { createUI } from "./ui.js";
import {
    clearArtworks,
    deleteArtwork,
    getArtworkById,
    getArtworks,
    getEquippedArtworkId,
    migrateLegacyGallery,
    saveArtwork,
    setEquippedArtworkId
} from "./storage.js";

const elements = {
    canvas: document.getElementById("gameCanvas"),
    scoreBoard: document.getElementById("scoreBoard"),
    logDisplay: document.getElementById("logDisplay"),
    startOverlay: document.getElementById("startOverlay"),
    resultOverlay: document.getElementById("resultOverlay"),
    artPreviewContainer: document.getElementById("artPreviewContainer"),
    galleryView: document.getElementById("galleryView"),
    galleryBoard: document.getElementById("galleryBoard"),
    archiveCount: document.getElementById("archiveCount"),
    archiveStatus: document.getElementById("archiveStatus"),
    emptyGalleryMsg: document.getElementById("emptyGalleryMsg"),
    viewGalleryBtn: document.getElementById("viewGalleryBtn"),
    backToGameBtn: document.getElementById("backToGameBtn"),
    clearGalleryBtn: document.getElementById("clearGalleryBtn"),
    saveArtBtn: document.getElementById("saveArtBtn"),
    retryBtn: document.getElementById("retryBtn"),
    viewGameBtn: document.getElementById("viewGameBtn")
};

const ui = createUI(document);

let game;
let equippedArtwork = null;
let archivedItems = [];

function createGame() {
    return new SnakeGame({
        canvas: elements.canvas,
        scoreBoard: elements.scoreBoard,
        logDisplay: elements.logDisplay,
        startOverlay: elements.startOverlay,
        resultOverlay: elements.resultOverlay,
        artPreviewContainer: elements.artPreviewContainer,
        audio: AudioEngine,
        equippedArtwork
    });
}

function resetGame() {
    game = createGame();
}

function formatArchiveDate(timestamp) {
    return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(timestamp);
}

function buildLineageSummary(item) {
    if (!item.parentId) {
        return "Origin Seed";
    }
    return `Gen ${item.generation} from #${item.parentId}`;
}

function refreshArchiveStatus() {
    elements.archiveStatus.textContent = equippedArtwork
        ? `Equipped Gen ${equippedArtwork.generation} / #${equippedArtwork.id}`
        : "No Equipped Lineage";
}

async function equipArtwork(item) {
    equippedArtwork = item;
    setEquippedArtworkId(item.id);
    if (game) {
        game.setEquippedArtwork(item);
    }
    refreshArchiveStatus();
    await fetchGallery();
    ui.showModal("LINEAGE LINKED", `기록 #${item.id}이 현재 개체의 부모 시드로 장착되었습니다.`, false);
}

function showLineage(item) {
    const parentLabel = item.parentId ? `#${item.parentId}` : "NONE";
    ui.showModal(
        "LINEAGE TRACE",
        `GEN ${item.generation} / PARENT ${parentLabel} / SCORE ${item.metrics?.score ?? 0} / LENGTH ${item.metrics?.length ?? 0}`,
        false
    );
}

function downloadArtwork(item) {
    const link = document.createElement("a");
    link.href = item.data;
    link.download = `snake-legacy-gen-${item.generation ?? 1}-record-${item.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function removeArtwork(item) {
    ui.showModal("PURGE RECORD", `기록 #${item.id}을(를) 삭제하시겠습니까?`, true, async () => {
        await deleteArtwork(item.id);
        if (equippedArtwork?.id === item.id) {
            equippedArtwork = null;
            setEquippedArtworkId(null);
            if (game) {
                game.setEquippedArtwork(null);
            }
        }
        refreshArchiveStatus();
        await fetchGallery();
    });
}

function renderArchiveCard(item, index) {
    const article = document.createElement("article");
    article.className = "gallery-item";
    const isEquipped = equippedArtwork?.id === item.id;
    article.innerHTML = `
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-[#00f2ff] text-lg uppercase tracking-[0.25em]">Record ${String(index + 1).padStart(3, "0")}</p>
                <h3 class="text-white text-3xl font-black italic uppercase tracking-tight">Signal Snapshot</h3>
            </div>
            <div class="text-right text-[#f3e5ab] text-lg uppercase tracking-[0.2em]">
                <p>${formatArchiveDate(item.createdAt)}</p>
            </div>
        </div>
        <div class="border-4 border-[#f3e5ab] bg-black overflow-hidden aspect-square">
            <img src="${item.data}" alt="Archived generative artwork ${index + 1}" class="w-full h-full object-cover">
        </div>
        <div class="grid grid-cols-2 gap-3 text-lg uppercase tracking-[0.18em]">
            <div class="border-2 border-white/20 bg-white/5 px-3 py-2 text-[#f3e5ab]">
                <p class="text-white/50">Archive ID</p>
                <p class="text-white">${item.id}</p>
            </div>
            <div class="border-2 border-white/20 bg-white/5 px-3 py-2 text-[#f3e5ab]">
                <p class="text-white/50">Status</p>
                <p class="text-white">${isEquipped ? "Equipped" : "Preserved"}</p>
            </div>
            <div class="border-2 border-white/20 bg-white/5 px-3 py-2 text-[#f3e5ab]">
                <p class="text-white/50">Generation</p>
                <p class="text-white">${item.generation ?? 1}</p>
            </div>
            <div class="border-2 border-white/20 bg-white/5 px-3 py-2 text-[#f3e5ab]">
                <p class="text-white/50">Lineage</p>
                <p class="text-white">${buildLineageSummary(item)}</p>
            </div>
        </div>
        <div class="grid grid-cols-4 gap-3">
            <button class="equip-btn retro-button ${isEquipped ? "bg-[#00f2ff] text-black" : "bg-[#f3e5ab] text-black"} px-4 py-3 font-bold border-2 border-black text-lg">
                ${isEquipped ? "EQUIPPED" : "EQUIP"}
            </button>
            <button class="lineage-btn retro-button bg-black text-white px-4 py-3 font-bold border-2 border-white text-lg">
                LINEAGE
            </button>
            <button class="download-btn retro-button bg-[#d9c27a] text-black px-4 py-3 font-bold border-2 border-black text-lg">
                DOWNLOAD
            </button>
            <button class="delete-btn retro-button bg-red-600 text-white px-4 py-3 font-bold border-2 border-black text-lg">
                DELETE
            </button>
        </div>
    `;

    article.querySelector(".equip-btn").onclick = () => {
        if (!isEquipped) {
            equipArtwork(item);
        }
    };
    article.querySelector(".lineage-btn").onclick = () => {
        showLineage(item);
    };
    article.querySelector(".download-btn").onclick = () => {
        downloadArtwork(item);
    };
    article.querySelector(".delete-btn").onclick = () => {
        removeArtwork(item);
    };

    return article;
}

async function fetchGallery() {
    elements.galleryBoard.innerHTML = "";

    archivedItems = await getArtworks();
    elements.emptyGalleryMsg.style.display = archivedItems.length ? "none" : "flex";
    elements.archiveCount.textContent = `${String(archivedItems.length).padStart(3, "0")} Records`;

    archivedItems.forEach((item, index) => {
        elements.galleryBoard.appendChild(renderArchiveCard(item, index));
    });
}

async function saveCurrentArt() {
    if (!game.lastGeneratedArt || !game.lastRunRecord) {
        return;
    }

    try {
        await saveArtwork(game.lastRunRecord);
        elements.resultOverlay.style.display = "none";
        ui.showModal("ARCHIVED", "데이터 유산이 성공적으로 보관되었습니다.", false);
        resetGame();
    } catch {
        ui.showModal("STORAGE ERROR", "작품 저장에 실패했습니다. 브라우저 저장공간 상태를 확인해주세요.", false);
    }
}

function bindEvents() {
    window.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
            event.preventDefault();
        }

        const player = game.player;
        if (event.key === " " && !game.gameOver && player.body.length > 3) {
            player.isBoosting = true;
        }

        let dirSet = false;
        if (event.key === "ArrowUp" && player.dir.y === 0) {
            player.nextDir = { x: 0, y: -1 };
            dirSet = true;
        }
        if (event.key === "ArrowDown" && player.dir.y === 0) {
            player.nextDir = { x: 0, y: 1 };
            dirSet = true;
        }
        if (event.key === "ArrowLeft" && player.dir.x === 0) {
            player.nextDir = { x: -1, y: 0 };
            dirSet = true;
        }
        if (event.key === "ArrowRight" && player.dir.x === 0) {
            player.nextDir = { x: 1, y: 0 };
            dirSet = true;
        }

        if (dirSet) {
            game.registerDirectionChange();
            game.start();
        }
    });

    window.addEventListener("keyup", (event) => {
        if (event.key === " ") {
            game.player.isBoosting = false;
        }
    });

    elements.viewGalleryBtn.onclick = async () => {
        elements.galleryView.classList.remove("hidden");
        await fetchGallery();
    };

    elements.backToGameBtn.onclick = () => {
        elements.galleryView.classList.add("hidden");
    };

    elements.clearGalleryBtn.onclick = () => {
        ui.showModal("DANGER", "정말 모든 로그를 삭제하시겠습니까?", true, async () => {
            await clearArtworks();
            equippedArtwork = null;
            setEquippedArtworkId(null);
            game.setEquippedArtwork(null);
            refreshArchiveStatus();
            await fetchGallery();
        });
    };

    elements.saveArtBtn.onclick = saveCurrentArt;
    elements.retryBtn.onclick = resetGame;
    elements.viewGameBtn.onclick = () => {
        elements.galleryView.classList.add("hidden");
    };
}

function animate(now) {
    game.update(now);
    game.draw(now);
    game.renderScoreboard();
    requestAnimationFrame(animate);
}

async function init() {
    await migrateLegacyGallery();
    const equippedId = getEquippedArtworkId();
    if (equippedId != null) {
        equippedArtwork = await getArtworkById(equippedId);
    }
    resetGame();
    refreshArchiveStatus();
    bindEvents();
    requestAnimationFrame(animate);
}

init().catch(() => {
    ui.showModal("BOOT FAILURE", "초기화 중 문제가 발생했습니다. 페이지를 새로고침해 주세요.", false);
});
