import { Platform } from "../../../../appAluno/js/core/platform.js?v=build-20260813-1";
import { DEFAULT_BRAND_THEME, LOCAL_BRAND_ASSETS_KEY } from "../../../../appAluno/js/core/brand-theme.js?v=build-20260818-1";
import { initialsFromName } from "../../utils/formatters.js?v=build-20260816-1";

export const createLocalAssetsEditor = ({
  getAuthContext,
  setStatus,
  showToast,
  setText,
  setThemeStatus,
  getRemoteBrandAssets,
  uploadBrandAsset,
  removeBrandAsset,
  onRemoteBrandAssetChanged,
  setBrandMark
}) => {
  const brandInput = document.querySelector("[data-brand-input]");
  const logoFrameInput = document.querySelector("[data-logo-frame-input]");
  const assetCropDialog = document.querySelector("[data-asset-crop-dialog]");
  const assetCropImage = document.querySelector("[data-asset-crop-image]");
  const assetCropTitle = document.querySelector("[data-asset-crop-title]");
  const assetCropStatus = document.querySelector("[data-asset-crop-status]");
  const assetCropZoom = document.querySelector("[data-asset-crop-zoom]");
  const assetCropConfirm = document.querySelector("[data-asset-crop-confirm]");
  let assetCropper = null;
  let pendingLocalAsset = null;
  let assetCropBaseRatio = 1;
  let isProcessingLocalAsset = false;

  const readLocalBrandAssets = () => Platform.storage.get(LOCAL_BRAND_ASSETS_KEY, {});
  const readRemoteBrandAssets = () => getRemoteBrandAssets?.() || {};
  
  const writeLocalBrandAssets = (assets = {}) => {
    const current = readLocalBrandAssets();
    return Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, { ...current, ...assets });
  };
  
  const renderLocalBrandAssets = () => {
    const assets = readLocalBrandAssets();
    const remote = readRemoteBrandAssets();
    const logoSource = assets.logoDataUrl || remote.logoUrl || "";
    const photoSource = assets.photoDataUrl || remote.photoUrl || "";
    const logoFrameEnabled = assets.logoFrameEnabled !== undefined
      ? assets.logoFrameEnabled !== false
      : remote.logoFrameEnabled !== false;
    setBrandMark?.(logoSource, logoFrameEnabled);
    document.querySelectorAll("[data-coach-initials]").forEach((target) => {
      target.replaceChildren();
      if (photoSource) {
        const image = document.createElement("img");
        image.src = photoSource;
        image.alt = "Foto do personal";
        target.append(image);
        target.classList.add("has-image");
      } else {
        target.classList.remove("has-image");
        target.textContent = initialsFromName(getAuthContext()?.profile?.name || getAuthContext()?.email || "PF");
      }
    });
    const logoTarget = document.querySelector("[data-preview-logo]");
    if (logoTarget) {
      if (logoSource) {
        logoTarget.innerHTML = "";
        const image = document.createElement("img");
        image.src = logoSource;
        image.alt = "Logo da marca";
        logoTarget.append(image);
      } else {
        const initials = (brandInput?.value || DEFAULT_BRAND_THEME.brandName).trim().slice(0, 2).toUpperCase() || "FF";
        logoTarget.textContent = initials;
      }
      logoTarget.classList.toggle("is-frameless", Boolean(logoSource) && !logoFrameEnabled);
    }
  
    if (logoFrameInput) {
      logoFrameInput.checked = logoFrameEnabled;
      logoFrameInput.setAttribute("aria-checked", String(logoFrameEnabled));
    }
  
    const photoWrap = document.querySelector("[data-preview-photo-wrap]");
    if (photoWrap) {
      photoWrap.innerHTML = "";
      if (photoSource) {
        const image = document.createElement("img");
        image.className = "preview-photo";
        image.src = photoSource;
        image.alt = "Foto do personal";
        photoWrap.append(image);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "avatar";
        fallback.dataset.previewPhotoFallback = "";
        fallback.textContent = initialsFromName(getAuthContext()?.profile?.name || getAuthContext()?.email || "PF");
        photoWrap.append(fallback);
      }
    }
  
    setText("[data-logo-file-name]", assets.logoName || remote.logoPath?.split("/").pop() || "Nenhum arquivo selecionado");
    setText("[data-photo-file-name]", assets.photoName || remote.photoPath?.split("/").pop() || "Nenhum arquivo selecionado");
  };
  
  const LOCAL_ASSET_OUTPUT = Object.freeze({
    logo: { prefix: "logo", label: "Logo", maxDimension: 512, quality: 0.9 },
    photo: { prefix: "photo", label: "Foto", maxDimension: 256, quality: 0.85 }
  });
  
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Falha ao ler imagem.")));
    reader.readAsDataURL(file);
  });
  
  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("O navegador não conseguiu gerar a imagem."));
    }, type, quality);
  });
  
  const setAssetCropStatus = (message, state = "") => setStatus(assetCropStatus, message, state);
  
  const setAssetCropControlsBusy = (busy) => {
    isProcessingLocalAsset = busy;
    if (assetCropConfirm) {
      assetCropConfirm.disabled = busy || !assetCropper;
      assetCropConfirm.textContent = busy ? "Processando…" : "Usar recorte";
    }
    document.querySelectorAll("[data-asset-crop-cancel]").forEach((button) => { button.disabled = busy; });
  };
  
  const disposeAssetCropper = () => {
    assetCropper?.destroy();
    assetCropper = null;
    assetCropBaseRatio = 1;
    if (assetCropImage) {
      assetCropImage.onload = null;
      assetCropImage.onerror = null;
      assetCropImage.removeAttribute("src");
    }
    if (pendingLocalAsset?.objectUrl) URL.revokeObjectURL(pendingLocalAsset.objectUrl);
    if (pendingLocalAsset?.input) pendingLocalAsset.input.value = "";
    pendingLocalAsset = null;
    if (assetCropZoom) assetCropZoom.value = "1";
    setAssetCropControlsBusy(false);
    if (assetCropConfirm) assetCropConfirm.disabled = true;
  };
  
  const closeAssetCropDialog = () => {
    if (isProcessingLocalAsset) return;
    if (assetCropDialog?.open) assetCropDialog.close();
    else disposeAssetCropper();
  };
  
  const setAssetCropZoom = (value) => {
    if (!assetCropper || !assetCropZoom) return;
    const normalized = Number(value) || 1;
    assetCropZoom.value = String(normalized);
    assetCropper.zoomTo(assetCropBaseRatio * normalized);
  };
  
  const openAssetCropDialog = (file, input, type) => {
    const spec = LOCAL_ASSET_OUTPUT[type];
    if (!spec || !assetCropDialog || !assetCropImage || !window.Cropper) {
      if (input) input.value = "";
      showToast("O editor de recorte não pôde ser carregado.");
      return;
    }
  
    disposeAssetCropper();
    const objectUrl = URL.createObjectURL(file);
    pendingLocalAsset = { file, input, type, objectUrl };
    if (assetCropTitle) assetCropTitle.textContent = type === "logo" ? "Recortar logo" : "Ajustar foto do personal";
    setAssetCropStatus("Preparando imagem…");
    if (assetCropConfirm) assetCropConfirm.disabled = true;
    if (!assetCropDialog.open) assetCropDialog.showModal();
  
    assetCropImage.onload = () => {
      if (pendingLocalAsset?.objectUrl !== objectUrl) return;
      assetCropper = new window.Cropper(assetCropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.82,
        background: false,
        guides: true,
        center: true,
        highlight: false,
        movable: true,
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: true,
        wheelZoomRatio: 0.08,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
        responsive: true,
        restore: false,
        checkOrientation: true,
        ready() {
          if (!assetCropper || pendingLocalAsset?.objectUrl !== objectUrl) return;
          assetCropBaseRatio = Math.max(0.0001, Number(assetCropper.getImageData()?.ratio) || 1);
          if (assetCropZoom) {
            const imageData = assetCropper.getImageData();
            const canvasData = assetCropper.getCanvasData();
            const containerData = assetCropper.getContainerData();
            const minZoom = Math.min(
              containerData.width / imageData.naturalWidth,
              containerData.height / imageData.naturalHeight
            );
            const maxZoom = canvasData.width / imageData.naturalWidth * 4;
            assetCropZoom.min = minZoom.toFixed(2);
            assetCropZoom.max = maxZoom.toFixed(2);
            assetCropZoom.value = "1";
          }
          if (assetCropConfirm) assetCropConfirm.disabled = false;
          setAssetCropStatus(`Saída quadrada em WebP, até ${spec.maxDimension}×${spec.maxDimension}.`);
        },
        zoom(event) {
          if (!assetCropZoom || !assetCropBaseRatio) return;
          const normalized = Number(event.detail?.ratio || assetCropBaseRatio) / assetCropBaseRatio;
          assetCropZoom.value = String(normalized);
        }
      });
    };
  
    assetCropImage.onerror = () => {
      setAssetCropStatus("Este formato de imagem não pôde ser aberto pelo navegador.", "warning");
      if (assetCropConfirm) assetCropConfirm.disabled = true;
    };
    assetCropImage.src = objectUrl;
  };
  
  const handleLocalAssetInput = (input, type) => {
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      input.value = "";
      showToast("Escolha um arquivo de imagem.");
      return;
    }
    openAssetCropDialog(file, input, type);
  };
  
  const squareCanvasWithinLimit = (sourceCanvas, maxDimension) => {
    const sourceSize = Math.max(1, Math.min(sourceCanvas.width, sourceCanvas.height));
    const outputSize = Math.max(1, Math.min(maxDimension, sourceSize));
    if (sourceCanvas.width === outputSize && sourceCanvas.height === outputSize) return sourceCanvas;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível neste navegador.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      sourceCanvas,
      (sourceCanvas.width - sourceSize) / 2,
      (sourceCanvas.height - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );
    return canvas;
  };
  
  const croppedAssetName = (file, type) => {
    const fallback = type === "logo" ? "logo" : "avatar";
    const base = String(file?.name || fallback).replace(/\.[^.]+$/, "").trim() || fallback;
    return `${base}-recortado.webp`;
  };
  
  const saveCroppedLocalAsset = async () => {
    if (!assetCropper || !pendingLocalAsset || isProcessingLocalAsset) return;
    const { file, type } = pendingLocalAsset;
    const spec = LOCAL_ASSET_OUTPUT[type];
    if (!spec) return;
  
    setAssetCropControlsBusy(true);
    setAssetCropStatus("Processando recorte…");
    try {
      const croppedCanvas = assetCropper.getCroppedCanvas({
        maxWidth: spec.maxDimension,
        maxHeight: spec.maxDimension,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"
      });
      if (!croppedCanvas?.width || !croppedCanvas?.height) throw new Error("O recorte ficou vazio.");
      const outputCanvas = squareCanvasWithinLimit(croppedCanvas, spec.maxDimension);
      const blob = await canvasToBlob(outputCanvas, "image/webp", spec.quality);
      if (blob.type !== "image/webp") throw new Error("Este navegador não oferece exportação WebP.");
      const dataUrl = await fileToDataUrl(blob);
      const saved = writeLocalBrandAssets({
        [`${spec.prefix}DataUrl`]: dataUrl,
        [`${spec.prefix}Name`]: croppedAssetName(file, type),
        [`${spec.prefix}Width`]: outputCanvas.width,
        [`${spec.prefix}Height`]: outputCanvas.height,
        [`${spec.prefix}MimeType`]: blob.type,
        [`${spec.prefix}Quality`]: spec.quality
      });
      if (!saved) throw new Error("Não há espaço local suficiente para salvar a imagem.");

      let remoteResult = null;
      if (uploadBrandAsset) {
        setAssetCropStatus("Salvando na nuvem…");
        remoteResult = await uploadBrandAsset(type, blob);
        if (remoteResult?.synced) {
          onRemoteBrandAssetChanged?.(type, remoteResult.theme || remoteResult);
        }
      }
      renderLocalBrandAssets();
      if (remoteResult && !remoteResult.synced) {
        setThemeStatus(`${spec.label} salva neste aparelho, mas não foi publicada. Verifique a conexão e tente novamente.`, "warning");
        showToast(`${spec.label} salva localmente; publicação pendente.`);
      } else {
        setThemeStatus(`${spec.label}: ${outputCanvas.width}×${outputCanvas.height}, WebP, publicada no app.`, "synced");
        showToast(type === "logo" ? "Logo publicada." : "Foto publicada.");
      }
      isProcessingLocalAsset = false;
      assetCropDialog?.close();
    } catch (error) {
      setAssetCropStatus(error?.message || "Não foi possível processar esta imagem.", "warning");
      setAssetCropControlsBusy(false);
    }
  };

  const clearBrandAssets = async () => {
    Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, {});
    const results = [];
    if (removeBrandAsset) {
      results.push(await removeBrandAsset("logo"));
      results.push(await removeBrandAsset("photo"));
      results.forEach((result, index) => {
        if (result?.synced) onRemoteBrandAssetChanged?.(index === 0 ? "logo" : "photo", result.theme || result);
      });
    }
    renderLocalBrandAssets();
    return results;
  };

  const syncLegacyBrandAssets = async () => {
    const local = readLocalBrandAssets();
    const remote = readRemoteBrandAssets();
    if (!uploadBrandAsset) return [];
    const pending = [
      { type: "logo", source: local.logoDataUrl, remotePath: remote.logoPath },
      { type: "photo", source: local.photoDataUrl, remotePath: remote.photoPath }
    ].filter((asset) => asset.source && !asset.remotePath);
    const results = [];
    for (const asset of pending) {
      try {
        const response = await fetch(asset.source);
        if (!response.ok) continue;
        const blob = await response.blob();
        const result = await uploadBrandAsset(asset.type, blob);
        results.push({ ...result, type: asset.type });
        if (result?.synced) onRemoteBrandAssetChanged?.(asset.type, result.theme || result);
      } catch (error) {
        results.push({ synced: false, type: asset.type, error });
      }
    }
    if (results.some((result) => result?.synced)) renderLocalBrandAssets();
    return results;
  };
  
  

  return {
    readLocalBrandAssets,
    writeLocalBrandAssets,
    renderLocalBrandAssets,
    handleLocalAssetInput,
    saveCroppedLocalAsset,
    clearBrandAssets,
    syncLegacyBrandAssets,
    closeAssetCropDialog,
    disposeAssetCropper,
    setAssetCropZoom,
    isProcessing: () => isProcessingLocalAsset
  };
};
