import { Platform } from "../../../../appAluno/js/core/platform.js?v=build-20260813-1";
import { DEFAULT_BRAND_THEME, LOCAL_BRAND_ASSETS_KEY } from "../../../../appAluno/js/core/brand-theme.js?v=build-20260816-2";
import { initialsFromName } from "../../utils/formatters.js?v=build-20260816-1";

export const createLocalAssetsEditor = ({
  getAuthContext,
  setStatus,
  showToast,
  setText,
  setThemeStatus
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
  
  const writeLocalBrandAssets = (assets = {}) => {
    const current = readLocalBrandAssets();
    return Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, { ...current, ...assets });
  };
  
  const renderLocalBrandAssets = () => {
    const assets = readLocalBrandAssets();
    const logoFrameEnabled = assets.logoFrameEnabled !== false;
    const logoTarget = document.querySelector("[data-preview-logo]");
    if (logoTarget) {
      if (assets.logoDataUrl) {
        logoTarget.innerHTML = `<img src="${assets.logoDataUrl}" alt="Logo local da marca" />`;
      } else {
        const initials = (brandInput?.value || DEFAULT_BRAND_THEME.brandName).trim().slice(0, 2).toUpperCase() || "FF";
        logoTarget.textContent = initials;
      }
      logoTarget.classList.toggle("is-frameless", Boolean(assets.logoDataUrl) && !logoFrameEnabled);
    }
  
    if (logoFrameInput) {
      logoFrameInput.checked = logoFrameEnabled;
      logoFrameInput.setAttribute("aria-checked", String(logoFrameEnabled));
    }
  
    const photoWrap = document.querySelector("[data-preview-photo-wrap]");
    if (photoWrap) {
      photoWrap.innerHTML = assets.photoDataUrl
        ? `<img class="preview-photo" src="${assets.photoDataUrl}" alt="Foto local do personal" />`
        : `<span class="avatar" data-preview-photo-fallback>${initialsFromName(getAuthContext()?.profile?.name || getAuthContext()?.email || "PF")}</span>`;
    }
  
    setText("[data-logo-file-name]", assets.logoName || "Nenhum arquivo selecionado");
    setText("[data-photo-file-name]", assets.photoName || "Nenhum arquivo selecionado");
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
    const normalized = Math.min(4, Math.max(1, Number(value) || 1));
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
          if (assetCropZoom) assetCropZoom.value = "1";
          if (assetCropConfirm) assetCropConfirm.disabled = false;
          setAssetCropStatus(`Saída quadrada em WebP, até ${spec.maxDimension}×${spec.maxDimension}.`);
        },
        zoom(event) {
          if (!assetCropZoom || !assetCropBaseRatio) return;
          const normalized = Number(event.detail?.ratio || assetCropBaseRatio) / assetCropBaseRatio;
          assetCropZoom.value = String(Math.min(4, Math.max(1, normalized)));
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
  
      renderLocalBrandAssets();
      setThemeStatus(`${spec.label}: ${outputCanvas.width}×${outputCanvas.height}, WebP, salva neste navegador.`, "warning");
      showToast(type === "logo" ? "Logo recortado e otimizado." : "Foto recortada e otimizada.");
      isProcessingLocalAsset = false;
      assetCropDialog?.close();
    } catch (error) {
      setAssetCropStatus(error?.message || "Não foi possível processar esta imagem.", "warning");
      setAssetCropControlsBusy(false);
    }
  };
  
  

  return {
    readLocalBrandAssets,
    writeLocalBrandAssets,
    renderLocalBrandAssets,
    handleLocalAssetInput,
    saveCroppedLocalAsset,
    closeAssetCropDialog,
    disposeAssetCropper,
    setAssetCropZoom,
    isProcessing: () => isProcessingLocalAsset
  };
};
