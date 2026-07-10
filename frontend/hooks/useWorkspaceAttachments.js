import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";

function safeId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ns-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferKind(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.includes("pdf") || /\.(pdf|doc|docx|txt|md|rtf|odt)$/.test(name)) return "document";
  if (/(\.csv|\.tsv|\.xlsx|\.xls|\.parquet)$/.test(name)) return "data";
  if (/(\.js|\.jsx|\.ts|\.tsx|\.py|\.rb|\.go|\.rs|\.java|\.c|\.cpp|\.css|\.html|\.json|\.yml|\.yaml|\.sql)$/.test(name)) return "code";
  return "file";
}

async function enrichFileMetadata(file, kind) {
  const result = {};
  if (kind === "image") {
    result.previewUrl = URL.createObjectURL(file);
    result.description = "Image preview ready";
    return result;
  }
  if (kind === "code" || kind === "data") {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      if (kind === "code") result.lineCount = lines.length;
      if (kind === "data") result.rowCount = Math.max(0, lines.length - 1);
    } catch {
      // ignore metadata extraction errors
    }
  }
  return result;
}

export default function useWorkspaceAttachments({
  token,
  onAuthError,
  activeThread,
  activeThreadId,
  mainView,
  railTab,
  workspace,
  maxFileSize,
  maxFilesPerMessage,
  workspaceLimit,
  updateThreadById,
  setThreads,
  setActiveThreadId,
  setMainView,
  setRailTab,
  setRailOpen,
  createThread,
}) {
  const [uploadCategory, setUploadCategory] = useState("documents");
  const [uploadContext, setUploadContext] = useState("composer");
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [selectedLibraryFiles, setSelectedLibraryFiles] = useState([]);
  const [lastSelectedLibraryIndex, setLastSelectedLibraryIndex] = useState(-1);
  const [libraryView, setLibraryView] = useState("grid");
  const [libraryFilters, setLibraryFilters] = useState({ type: "all", source: "all", date: "all", project: "all" });
  const [globalDropVisible, setGlobalDropVisible] = useState(false);
  const [selectedRailFileId, setSelectedRailFileId] = useState("");
  const [attachmentError, setAttachmentError] = useState("");

  const composerFileInputRef = useRef(null);
  const dashboardFileInputRef = useRef(null);
  const artifactFileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const queueFilesRef = useRef(null);

  const fileLookup = useMemo(
    () => Object.fromEntries(workspaceFiles.map((file) => [file.id, file])),
    [workspaceFiles],
  );
  const workspaceBytesUsed = useMemo(
    () => workspaceFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [workspaceFiles],
  );

  function startBackgroundExtraction(fileId, kind) {
    window.setTimeout(() => {
      setWorkspaceFiles((current) => current.map((file) => {
        if (file.id !== fileId) return file;
        return {
          ...file,
          processing: false,
          extractReady: true,
          status: file.status === "failed" ? "failed" : "indexed",
          extractBadge: kind === "audio"
            ? "Transcript ready"
            : kind === "image"
              ? "Description ready"
              : "Text extracted",
        };
      }));
    }, 1600 + Math.round(Math.random() * 1400));
  }

  async function indexFileInBackend(file) {
    if (!token) {
      return {
        status: "indexed",
        status_chip: "ready",
        chunk_count: 0,
        token_count: 0,
        last_indexed: null,
        file_id: "",
      };
    }
    const form = new FormData();
    form.append("files", file, file.name);
    const res = await fetch(`${API_BASE}/api/knowledge/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (res.status === 401 && typeof onAuthError === "function") {
      onAuthError();
      throw new Error("unauthorized");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.detail || "Indexing failed");
    }
    const uploaded = Array.isArray(body.uploaded) ? body.uploaded[0] : null;
    if (!uploaded) {
      throw new Error("No indexing metadata returned");
    }
    return uploaded;
  }

  function uploadFileWithProgress(fileRecord, file, kind) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.min(96, Math.round((event.loaded / event.total) * 96));
        setWorkspaceFiles((current) => current.map((item) => (
          item.id === fileRecord.id ? { ...item, progress } : item
        )));
      };
      reader.onerror = () => {
        setWorkspaceFiles((current) => current.map((item) => (
          item.id === fileRecord.id ? { ...item, progress: 100, error: "Upload failed" } : item
        )));
        resolve();
      };
      reader.onload = async () => {
        const metadata = await enrichFileMetadata(file, kind);
        setWorkspaceFiles((current) => current.map((item) => (
          item.id === fileRecord.id
            ? {
              ...item,
              ...metadata,
              progress: 98,
              uploaded: true,
              processing: true,
              status: "parsing",
              statusLabel: "parsing",
              extractReady: false,
            }
            : item
        )));
        try {
          setWorkspaceFiles((current) => current.map((item) => (
            item.id === fileRecord.id
              ? { ...item, status: "chunking", statusLabel: "chunking" }
              : item
          )));
          const indexed = await indexFileInBackend(file);
          setWorkspaceFiles((current) => current.map((item) => (
            item.id === fileRecord.id
              ? {
                ...item,
                progress: 100,
                uploaded: true,
                processing: false,
                extractReady: true,
                extractBadge: "Indexed",
                status: indexed.status || "indexed",
                statusLabel: indexed.status_chip || "ready",
                backendFileId: indexed.file_id || "",
                chunkCount: indexed.chunk_count || 0,
                tokenCount: indexed.token_count || 0,
                lastIndexed: indexed.last_indexed || null,
              }
              : item
          )));
        } catch (err) {
          const message = err?.message || "Indexing failed";
          setWorkspaceFiles((current) => current.map((item) => (
            item.id === fileRecord.id
              ? {
                ...item,
                progress: 100,
                uploaded: true,
                processing: false,
                status: "failed",
                statusLabel: "failed",
                error: message,
              }
              : item
          )));
        }
        startBackgroundExtraction(fileRecord.id, kind);
        resolve();
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function queueFiles(fileList, context = "composer") {
    const filesArray = Array.from(fileList || []);
    if (!filesArray.length) return;

    setAttachmentError("");

    if ((context === "composer" || context === "artifact")
      && activeThread
      && activeThread.attachments.length + filesArray.length > maxFilesPerMessage) {
      setAttachmentError(`You can attach up to ${maxFilesPerMessage} files per message.`);
      return;
    }

    const valid = [];
    let nextWorkspaceUsage = workspaceBytesUsed;

    for (const file of filesArray) {
      if (file.size > maxFileSize) {
        setAttachmentError(`${file.name} exceeds the 50MB limit.`);
        continue;
      }
      if (nextWorkspaceUsage + file.size > workspaceLimit) {
        setAttachmentError("Workspace storage limit reached (5GB).");
        break;
      }
      nextWorkspaceUsage += file.size;
      valid.push(file);
    }

    if (!valid.length) return;

    const records = valid.map((file) => {
      const kind = inferKind(file);
      return {
        id: safeId(),
        name: file.name,
        size: file.size,
        mimeType: file.type,
        kind,
        source: "uploaded",
        project: workspace,
        createdAt: Date.now(),
        uploaded: false,
        progress: 0,
        processing: true,
        extractReady: false,
        extractBadge: "Processing...",
        status: "uploading",
        statusLabel: "uploading",
        includeInContext: true,
        chunkCount: 0,
        tokenCount: 0,
        lastIndexed: null,
        blobUrl: URL.createObjectURL(file),
      };
    });

    setWorkspaceFiles((current) => [...records, ...current]);

    if ((context === "composer" || context === "artifact") && activeThreadId) {
      if (context === "artifact") {
        setRailTab("artifact");
        setRailOpen(true);
      }
      updateThreadById(activeThreadId, (thread) => ({
        ...thread,
        attachments: [...thread.attachments, ...records.map((record) => record.id)],
      }));
    }

    if (context === "dashboard") {
      setMainView("library");
    }

    for (let i = 0; i < records.length; i += 1) {
      await uploadFileWithProgress(records[i], valid[i], records[i].kind);
    }
  }

  queueFilesRef.current = queueFiles;

  useEffect(() => {
    function hasDraggedFiles(event) {
      const types = event?.dataTransfer?.types;
      if (!types) return false;
      return Array.from(types).includes("Files");
    }

    function onDragEnter(event) {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      dragCounterRef.current += 1;
      setGlobalDropVisible(true);
    }

    function onDragOver(event) {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
    }

    function onDragLeave(event) {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setGlobalDropVisible(false);
      }
    }

    function onDrop(event) {
      if (!hasDraggedFiles(event)) {
        clearDropOverlay();
        return;
      }
      event.preventDefault();
      dragCounterRef.current = 0;
      setGlobalDropVisible(false);
      const dropped = event.dataTransfer?.files;
      if (dropped?.length) {
        const context = mainView === "library" ? "dashboard" : railTab === "artifact" ? "artifact" : "composer";
        queueFilesRef.current?.(dropped, context);
      }
    }

    function clearDropOverlay() {
      dragCounterRef.current = 0;
      setGlobalDropVisible(false);
    }

    function onWindowPaste(event) {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const pastedFiles = [];
      for (const item of clipboard.items || []) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length) {
        const context = mainView === "library" ? "dashboard" : railTab === "artifact" ? "artifact" : "composer";
        queueFilesRef.current?.(pastedFiles, context);
      }
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", clearDropOverlay);
    window.addEventListener("blur", clearDropOverlay);
    document.addEventListener("visibilitychange", clearDropOverlay);
    window.addEventListener("paste", onWindowPaste);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", clearDropOverlay);
      window.removeEventListener("blur", clearDropOverlay);
      document.removeEventListener("visibilitychange", clearDropOverlay);
      window.removeEventListener("paste", onWindowPaste);
    };
  }, [mainView, railTab]);

  function openUploadPicker(context = "composer") {
    setUploadContext(context);
    const targetRef = context === "dashboard"
      ? dashboardFileInputRef
      : context === "artifact"
        ? artifactFileInputRef
        : composerFileInputRef;
    targetRef.current?.click();
  }

  function handlePickerSelection(event, context) {
    queueFiles(event.target.files, context);
    // Reset for same-file re-picks.
    // eslint-disable-next-line no-param-reassign
    event.target.value = "";
  }

  function openFilePreview(fileId) {
    setSelectedRailFileId(fileId);
    setRailTab("files");
    setRailOpen(true);
  }

  function addFileToNewChat(fileId) {
    const next = createThread("New thread");
    next.attachments = [fileId];
    setThreads((current) => [next, ...current]);
    setActiveThreadId(next.id);
    setMainView("conversation");
    setSelectedRailFileId(fileId);
  }

  function markFilesUsedInThread(fileIds, threadId) {
    if (!fileIds?.length || !threadId) return;
    setWorkspaceFiles((current) => current.map((file) => (
      fileIds.includes(file.id)
        ? { ...file, usedIn: [...new Set([...(file.usedIn || []), threadId])] }
        : file
    )));
  }

  function downloadFile(fileId) {
    const file = fileLookup[fileId];
    if (!file?.blobUrl) return;
    const anchor = document.createElement("a");
    anchor.href = file.blobUrl;
    anchor.download = file.name;
    anchor.click();
  }

  function deleteFile(fileId) {
    setWorkspaceFiles((current) => current.filter((file) => file.id !== fileId));
    setThreads((current) => current.map((thread) => ({
      ...thread,
      attachments: (thread.attachments || []).filter((id) => id !== fileId),
      messages: thread.messages.map((message) => ({
        ...message,
        attachments: (message.attachments || []).filter((id) => id !== fileId),
      })),
    })));
    setSelectedRailFileId((current) => (current === fileId ? "" : current));
  }

  function toggleLibrarySelection(fileId, index, withShift, lastIndex) {
    setSelectedLibraryFiles((current) => {
      if (withShift && lastIndex >= 0) {
        const ordered = [...workspaceFiles].sort((a, b) => b.createdAt - a.createdAt);
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        const range = ordered.slice(start, end + 1).map((file) => file.id);
        return [...new Set([...current, ...range])];
      }
      return current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId];
    });
  }

  function handleLibraryBulkAction(action) {
    if (!selectedLibraryFiles.length) return;
    if (action === "add-to-chat") {
      const next = createThread("New thread");
      next.attachments = [...selectedLibraryFiles].slice(0, maxFilesPerMessage);
      setThreads((current) => [next, ...current]);
      setActiveThreadId(next.id);
      setMainView("conversation");
      return;
    }
    if (action === "move-project") {
      setWorkspaceFiles((current) => current.map((file) => (
        selectedLibraryFiles.includes(file.id) ? { ...file, project: workspace } : file
      )));
      return;
    }
    if (action === "delete") {
      const ids = new Set(selectedLibraryFiles);
      setWorkspaceFiles((current) => current.filter((file) => !ids.has(file.id)));
      setSelectedLibraryFiles([]);
      setThreads((current) => current.map((thread) => ({
        ...thread,
        attachments: (thread.attachments || []).filter((id) => !ids.has(id)),
        messages: thread.messages.map((message) => ({
          ...message,
          attachments: (message.attachments || []).filter((id) => !ids.has(id)),
        })),
      })));
    }
  }

  return {
    uploadCategory,
    setUploadCategory,
    uploadContext,
    workspaceFiles,
    setWorkspaceFiles,
    fileLookup,
    selectedLibraryFiles,
    lastSelectedLibraryIndex,
    setLastSelectedLibraryIndex,
    libraryView,
    setLibraryView,
    libraryFilters,
    setLibraryFilters,
    globalDropVisible,
    selectedRailFileId,
    setSelectedRailFileId,
    attachmentError,
    composerFileInputRef,
    dashboardFileInputRef,
    artifactFileInputRef,
    queueFiles,
    openUploadPicker,
    handlePickerSelection,
    openFilePreview,
    addFileToNewChat,
    markFilesUsedInThread,
    downloadFile,
    deleteFile,
    toggleLibrarySelection,
    handleLibraryBulkAction,
  };
}
