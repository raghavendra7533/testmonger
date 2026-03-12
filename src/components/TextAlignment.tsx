import React from "react";

interface TextAlignmentProps {
  text: string;
  alignment: "left" | "center" | "right";
}

export const TextAlignment: React.FC<TextAlignmentProps> = ({ text, alignment }) => {
  return (
    <div 
      data-cy="text-alignment-container"
      style={{ textAlign: alignment }}
    >
      <p data-cy="text-content">{text}</p>
      <button data-cy="align-left-btn">Left</button>
      <button data-cy="align-center-btn">Center</button>
      <button data-cy="align-right-btn">Right</button>
    </div>
  );
};