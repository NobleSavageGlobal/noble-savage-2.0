"use client";

import React, { useState, useRef, useEffect } from "react";

/**
 * ResizableLayout — Provides draggable dividers between panes
 * Usage: Wrap content in this component and pass pane elements
 */
export default function ResizableLayout({ 
  leftPane, 
  centerPane, 
  rightPane,
  rightCollapsed = false,
  onRightToggle,
  leftMinWidth = 240,
  rightMinWidth = 280,
  centerMinWidth = 400,
}) {
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const [dragging, setDragging] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Restore from localStorage on mount
    const saved = window.localStorage.getItem("ns_layout_widths");
    if (saved) {
      try {
        const { left, right } = JSON.parse(saved);
        if (left) setLeftWidth(Math.max(leftMinWidth, Math.min(left, 600)));
        if (right) setRightWidth(Math.max(rightMinWidth, Math.min(right, 600)));
      } catch {
        // Fall back to defaults if parse fails
      }
    }
  }, []);

  function handleMouseDown(e, side) {
    e.preventDefault();
    setDragging(side);
  }

  useEffect(() => {
    function handleMouseUp() {
      if (dragging) {
        setDragging(null);
        // Persist to localStorage
        window.localStorage.setItem(
          "ns_layout_widths",
          JSON.stringify({ left: leftWidth, right: rightWidth })
        );
      }
    }

    function handleMouseMove(e) {
      if (!dragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      if (dragging === "left") {
        const delta = e.clientX - containerRect.left;
        const nextWidth = Math.max(leftMinWidth, Math.min(delta, 600));
        setLeftWidth(nextWidth);
      }

      if (dragging === "right") {
        const delta = window.innerWidth - e.clientX;
        const nextWidth = Math.max(rightMinWidth, Math.min(delta, 600));
        setRightWidth(nextWidth);
      }
    }

    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, leftWidth, rightWidth, leftMinWidth, rightMinWidth]);

  const showRight = !rightCollapsed && rightPane;
  const rightWidthPx = showRight ? rightWidth : 0;
  const centerWidth = `calc(100% - ${leftWidth}px - ${rightWidthPx}px)`;

  return (
    <div
      ref={containerRef}
      className="resizable-layout"
      style={{
        display: "grid",
        gridTemplateColumns: `${leftWidth}px minmax(0, 1fr) ${rightWidthPx}px`,
        gap: "0",
        height: "100vh",
        transition: dragging ? "none" : "grid-template-columns 200ms ease",
      }}
    >
      {/* Left Pane */}
      <div className="resizable-pane resizable-left">
        {leftPane}
      </div>

      {/* Left Divider */}
      <div
        className={`resizable-divider resizable-divider-left ${dragging === "left" ? "dragging" : ""}`}
        onMouseDown={(e) => handleMouseDown(e, "left")}
        title="Drag to resize (or double-click to reset)"
        onDoubleClick={() => {
          setLeftWidth(300);
          window.localStorage.setItem(
            "ns_layout_widths",
            JSON.stringify({ left: 300, right: rightWidth })
          );
        }}
      />

      {/* Center Pane */}
      <div className="resizable-pane resizable-center">
        {centerPane}
      </div>

      {/* Right Divider (only if right pane visible) */}
      {showRight && (
        <>
          <div
            className={`resizable-divider resizable-divider-right ${dragging === "right" ? "dragging" : ""}`}
            onMouseDown={(e) => handleMouseDown(e, "right")}
            title="Drag to resize (or double-click to reset)"
            onDoubleClick={() => {
              setRightWidth(360);
              window.localStorage.setItem(
                "ns_layout_widths",
                JSON.stringify({ left: leftWidth, right: 360 })
              );
            }}
          />

          {/* Right Pane */}
          <div className="resizable-pane resizable-right">
            {rightPane}
          </div>
        </>
      )}
    </div>
  );
}
