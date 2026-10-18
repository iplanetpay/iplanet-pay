"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type DeviceMockupAngle = "left" | "straight" | "right";
export type DeviceMockupColor = "silver" | "orange" | "blue";

type Variant = {
  matrix: string;
  height: number;
  offsetX: number;
  offsetY: number;
  borderRadius: number;
  overlay: string;
};

/** Port of Framer Device_Mockups (BATEbx) — overlays under public/images/device-mockups. */
const VARIANTS: Record<`${DeviceMockupAngle}-${DeviceMockupColor}`, Variant> = {
  "right-silver": {
    matrix:
      "matrix3d(0.76631993,0.04182064,0,0.00009316,0,0.9743346,0,0,0,0,1,0,43.03649635,11.63117871,0,1)",
    height: 874,
    offsetX: 26,
    offsetY: 0,
    borderRadius: 40,
    overlay: "/images/device-mockups/right-silver.png",
  },
  "right-orange": {
    matrix:
      "matrix3d(0.76631993,0.04182064,0,0.00009316,0,0.9743346,0,0,0,0,1,0,43.03649635,11.63117871,0,1)",
    height: 874,
    offsetX: 26,
    offsetY: 0,
    borderRadius: 45,
    overlay: "/images/device-mockups/right-orange.png",
  },
  "right-blue": {
    matrix:
      "matrix3d(0.76631993,0.04182064,0,0.00009316,0,0.9743346,0,0,0,0,1,0,43.03649635,11.63117871,0,1)",
    height: 874,
    offsetX: 26,
    offsetY: 0,
    borderRadius: 40,
    overlay: "/images/device-mockups/right-blue.png",
  },
  "straight-silver": {
    matrix:
      "matrix3d(0.91970803,0,0,0,0,0.91340451,0,0,0,0,1,0,16.62773723,38.36061684,0,1)",
    height: 874,
    offsetX: -1,
    offsetY: 0,
    borderRadius: 40,
    overlay: "/images/device-mockups/straight-silver.png",
  },
  "straight-orange": {
    matrix:
      "matrix3d(0.91970803,0,0,0,0,0.91340451,0,0,0,0,1,0,16.62773723,38.36061684,0,1)",
    height: 874,
    offsetX: -1,
    offsetY: 0,
    borderRadius: 40,
    overlay: "/images/device-mockups/straight-orange.png",
  },
  "straight-blue": {
    matrix:
      "matrix3d(0.91970803,0,0,0,0,0.91340451,0,0,0,0,1,0,16.62773723,38.36061684,0,1)",
    height: 874,
    offsetX: -1,
    offsetY: 0,
    borderRadius: 40,
    overlay: "/images/device-mockups/straight-blue.png",
  },
  "left-silver": {
    matrix:
      "matrix3d(0.70722764,-0.03817134,0,-0.00008994,0.00013572,0.94225492,0,0.00000365,0,0,1,0,37.16788321,25.75475285,0,1)",
    height: 874,
    offsetX: 0,
    offsetY: 0,
    borderRadius: 45,
    overlay: "/images/device-mockups/left-silver.png",
  },
  "left-orange": {
    matrix:
      "matrix3d(0.70722764,-0.03817134,0,-0.00008994,0.00013572,0.94225492,0,0.00000365,0,0,1,0,37.16788321,25.75475285,0,1)",
    height: 874,
    offsetX: 0,
    offsetY: 0,
    borderRadius: 45,
    overlay: "/images/device-mockups/left-orange.png",
  },
  "left-blue": {
    matrix:
      "matrix3d(0.70722764,-0.03817134,0,-0.00008994,0.00013572,0.94225492,0,0.00000365,0,0,1,0,37.16788321,25.75475285,0,1)",
    height: 874,
    offsetX: 0,
    offsetY: 0,
    borderRadius: 45,
    overlay: "/images/device-mockups/left-blue.png",
  },
};

const DESIGN_WIDTH = 402;

type FramerDeviceMockupProps = {
  angle?: DeviceMockupAngle;
  color?: DeviceMockupColor;
  /** Inner screen content designed for 402×874 */
  children?: ReactNode;
  /** Alias for children */
  screen?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Client port of Framer `Device_Mockups` (no Framer editor runtime).
 * Scales by container width; overlays sit above the 402×874 screen slot.
 */
export function FramerDeviceMockup({
  angle = "straight",
  color = "silver",
  children,
  screen,
  className,
  style,
}: FramerDeviceMockupProps) {
  const key = `${angle}-${color}` as const;
  const { matrix, height, offsetX, offsetY, borderRadius, overlay } =
    VARIANTS[key];

  const containerRef = useRef<HTMLDivElement>(null);
  const [realWidth, setRealWidth] = useState(DESIGN_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const applyWidth = (w: number) => {
      if (w > 0) setRealWidth(w);
    };

    applyWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) applyWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = realWidth / DESIGN_WIDTH;
  const scaledHeight = height * scale;
  const mediaTransform = `translate(${offsetX}px, ${offsetY}px) ${matrix}`;
  const content = screen ?? children;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        overflow: "visible",
        position: "relative",
        height: scaledHeight,
        width: "100%",
      }}
    >
      <div
        style={{
          width: DESIGN_WIDTH,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <div
          style={{
            width: DESIGN_WIDTH,
            height,
            transform: mediaTransform,
            transformOrigin: "0 0",
            borderRadius,
            overflow: "hidden",
          }}
        >
          {content}
        </div>
        {/* Source PNGs are ~4096px tall; next/image serves a right-sized WebP/AVIF. */}
        <Image
          src={overlay}
          alt=""
          width={DESIGN_WIDTH}
          height={height}
          sizes="(max-width: 768px) 70vw, 320px"
          quality={85}
          loading="eager"
          draggable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: DESIGN_WIDTH,
            height,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}
