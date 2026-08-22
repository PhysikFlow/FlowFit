const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const canvasToWebp = (canvas, quality = 0.85) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("avatar_encode_failed"));
  }, "image/webp", quality);
});

export const createStudentProfileEditor = ({
  getCurrentStudent,
  getCurrentProfile,
  getAuthContext,
  setImageOrText,
  repository,
  onProfileUpdated,
  showToast
}) => {
  const dialog = document.querySelector("[data-student-profile-dialog]");
  const form = document.querySelector("[data-student-profile-form]");
  const avatarPreview = document.querySelector("[data-student-profile-avatar-preview]");
  const photoInput = document.querySelector("[data-student-profile-photo-input]");
  const photoRemove = document.querySelector("[data-student-profile-photo-remove]");
  const status = document.querySelector("[data-student-profile-status]");
  const saveButton = document.querySelector("[data-student-profile-save]");
  const cropDialog = document.querySelector("[data-student-avatar-crop-dialog]");
  const cropForm = document.querySelector("[data-student-avatar-crop-form]");
  const cropImage = document.querySelector("[data-student-avatar-crop-image]");
  const cropZoom = document.querySelector("[data-student-avatar-zoom]");
  const cropStatus = document.querySelector("[data-student-avatar-crop-status]");
  const cropConfirm = document.querySelector("[data-student-avatar-crop-confirm]");

  let cropper = null;
  let cropSourceUrl = "";
  let pendingAvatarBlob = null;
  let pendingAvatarUrl = "";
  let removeAvatar = false;
  let minimumZoomRatio = 1;

  const setStatus = (message = "", kind = "") => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-warning", kind === "warning");
    status.classList.toggle("is-synced", kind === "synced");
  };

  const setCropStatus = (message = "", kind = "") => {
    if (!cropStatus) return;
    cropStatus.textContent = message;
    cropStatus.classList.toggle("is-warning", kind === "warning");
  };

  const setBusy = (busy) => {
    if (saveButton) saveButton.disabled = busy;
    if (photoInput) photoInput.disabled = busy;
    if (photoRemove) photoRemove.disabled = busy;
    form?.querySelectorAll("input:not([readonly]), button").forEach((control) => {
      if (control !== saveButton && control !== photoRemove) control.disabled = busy;
    });
    form?.setAttribute("aria-busy", String(busy));
  };

  const initialsFor = (name) => String(name || "Aluno")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AL";

  const renderAvatarPreview = () => {
    const student = getCurrentStudent() || {};
    const profile = getCurrentProfile() || {};
    const displayName = form?.elements?.displayName?.value?.trim() || profile.displayName || student.name || "Aluno";
    const source = removeAvatar ? "" : pendingAvatarUrl || profile.avatarUrl || student.photoUrl || "";
    setImageOrText(avatarPreview, source, initialsFor(displayName), `Foto de ${displayName}`);
    if (photoRemove) photoRemove.hidden = !source;
  };

  const disposeCrop = () => {
    cropper?.destroy();
    cropper = null;
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
    cropSourceUrl = "";
    if (cropImage) cropImage.removeAttribute("src");
    if (photoInput) photoInput.value = "";
    setCropStatus();
  };

  const closeCrop = () => {
    if (cropDialog?.open) cropDialog.close();
    disposeCrop();
  };

  const disposePendingAvatar = () => {
    if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
    pendingAvatarUrl = "";
    pendingAvatarBlob = null;
    removeAvatar = false;
  };

  const populate = () => {
    const student = getCurrentStudent() || {};
    const profile = getCurrentProfile() || {};
    if (form?.elements?.displayName) form.elements.displayName.value = profile.displayName || student.displayName || "";
    if (form?.elements?.phone) form.elements.phone.value = profile.phone || student.phone || "";
    if (form?.elements?.email) form.elements.email.value = getAuthContext()?.email || student.email || "";
    setStatus();
    renderAvatarPreview();
  };

  const open = () => {
    disposePendingAvatar();
    populate();
    if (!dialog?.open) dialog?.showModal();
    window.setTimeout(() => form?.elements?.displayName?.focus(), 60);
  };

  const close = () => {
    closeCrop();
    disposePendingAvatar();
    if (dialog?.open) dialog.close();
  };

  const beginCrop = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > MAX_SOURCE_BYTES) {
      setStatus("Escolha uma imagem PNG, JPG ou WebP de até 15 MB.", "warning");
      if (photoInput) photoInput.value = "";
      return;
    }
    if (typeof globalThis.Cropper !== "function") {
      setStatus("O editor de recorte não carregou. Atualize o aplicativo e tente novamente.", "warning");
      return;
    }

    closeCrop();
    cropSourceUrl = URL.createObjectURL(file);
    cropImage.src = cropSourceUrl;
    cropDialog.showModal();
    cropper = new globalThis.Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      ready() {
        minimumZoomRatio = cropper?.getImageData()?.ratio || 1;
        if (cropZoom) cropZoom.value = "0";
      }
    });
  };

  const applyZoom = () => {
    if (!cropper || !cropZoom) return;
    const progress = Math.max(0, Math.min(1, Number(cropZoom.value) || 0));
    cropper.zoomTo(minimumZoomRatio * (1 + progress * 2));
  };

  document.querySelector("[data-profile-edit-open]")?.addEventListener("click", open);
  document.querySelectorAll("[data-student-profile-close]").forEach((button) => button.addEventListener("click", close));
  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  photoInput?.addEventListener("change", () => beginCrop(photoInput.files?.[0]));
  photoRemove?.addEventListener("click", () => {
    if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
    pendingAvatarUrl = "";
    pendingAvatarBlob = null;
    removeAvatar = true;
    renderAvatarPreview();
  });
  form?.elements?.displayName?.addEventListener("input", renderAvatarPreview);

  document.querySelectorAll("[data-student-avatar-crop-cancel]").forEach((button) => button.addEventListener("click", closeCrop));
  cropDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCrop();
  });
  cropDialog?.addEventListener("click", (event) => {
    if (event.target === cropDialog) closeCrop();
  });
  cropZoom?.addEventListener("input", applyZoom);
  document.querySelector("[data-student-avatar-zoom-out]")?.addEventListener("click", () => {
    if (!cropZoom) return;
    cropZoom.value = String(Math.max(0, Number(cropZoom.value) - 0.08));
    applyZoom();
  });
  document.querySelector("[data-student-avatar-zoom-in]")?.addEventListener("click", () => {
    if (!cropZoom) return;
    cropZoom.value = String(Math.min(1, Number(cropZoom.value) + 0.08));
    applyZoom();
  });

  cropForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!cropper) return;
    cropConfirm.disabled = true;
    setCropStatus("Processando recorte...");
    try {
      const canvas = cropper.getCroppedCanvas({
        width: 256,
        height: 256,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        fillColor: "transparent"
      });
      const blob = await canvasToWebp(canvas, 0.85);
      if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
      pendingAvatarBlob = blob;
      pendingAvatarUrl = URL.createObjectURL(blob);
      removeAvatar = false;
      closeCrop();
      renderAvatarPreview();
      setStatus("Recorte pronto. Salve o perfil para enviar a foto.");
    } catch {
      setCropStatus("Não foi possível processar esse recorte.", "warning");
    } finally {
      cropConfirm.disabled = false;
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Salvando perfil...");
    const values = new FormData(form);
    const saved = await repository.saveOwnProfile({
      displayName: values.get("displayName"),
      phone: values.get("phone"),
      authContext: getAuthContext()
    });
    if (!saved.synced) {
      setBusy(false);
      setStatus(saved.reason === "migration-required"
        ? "A atualização do banco ainda não foi aplicada. O perfil não foi alterado."
        : "Não foi possível salvar o perfil. Tente novamente.", "warning");
      return;
    }

    let finalProfile = saved.profile;
    let avatarResult = null;
    if (pendingAvatarBlob) {
      setStatus("Enviando foto com segurança...");
      avatarResult = await repository.uploadOwnAvatar(pendingAvatarBlob, { authContext: getAuthContext() });
    } else if (removeAvatar) {
      avatarResult = await repository.removeOwnAvatar({ authContext: getAuthContext() });
    }

    if (avatarResult?.profile) finalProfile = { ...finalProfile, ...avatarResult.profile };
    await onProfileUpdated(finalProfile);
    setBusy(false);
    if (avatarResult && !avatarResult.synced) {
      setStatus("Os dados foram salvos, mas a foto não pôde ser atualizada. Tente novamente.", "warning");
      return;
    }

    showToast("Perfil atualizado.");
    close();
  });

  return { open, close, populate };
};
