function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.className = className;
    button.textContent = label;
    button.onclick = onClick;
    return button;
}

export function createUI(doc = document) {
    const modal = doc.getElementById("customModal");
    const titleEl = doc.getElementById("modalTitle");
    const textEl = doc.getElementById("modalText");
    const buttonsEl = doc.getElementById("modalButtons");

    return {
        showModal(title, text, isConfirm, onConfirm) {
            titleEl.textContent = title;
            textEl.textContent = text;
            buttonsEl.innerHTML = "";

            if (isConfirm) {
                buttonsEl.appendChild(
                    createButton(
                        "PROCEED",
                        "retro-button bg-red-600 text-white px-6 py-2 border-2 border-black",
                        () => {
                            modal.style.display = "none";
                            onConfirm();
                        }
                    )
                );
                buttonsEl.appendChild(
                    createButton(
                        "CANCEL",
                        "retro-button bg-[#f3e5ab] text-black px-6 py-2 border-2 border-black",
                        () => {
                            modal.style.display = "none";
                        }
                    )
                );
            } else {
                buttonsEl.appendChild(
                    createButton(
                        "ACKNOWLEDGED",
                        "retro-button bg-[#00f2ff] text-black px-8 py-2 border-2 border-black",
                        () => {
                            modal.style.display = "none";
                        }
                    )
                );
            }

            modal.style.display = "flex";
        }
    };
}
