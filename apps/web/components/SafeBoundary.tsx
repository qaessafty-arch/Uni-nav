"use client";
import { Component, type ReactNode } from "react";

/** Optional widgets render inside this: if one throws, it disappears instead of taking the page down. */
export class SafeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Widget failed and was hidden:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
