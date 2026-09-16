import React from 'react';

export default function ReactiveTitle({ text, className = '', as: Tag = 'h2' }) {
  const words = text.split(' ');
  let key = 0;

  return (
    <Tag className={`reactive-title ${className}`}>
      {words.map((word, wi) => (
        <span className="rword" key={wi}>
          {Array.from(word).map((ch) => (
            <span className="rchar" key={key++}>{ch}</span>
          ))}
          {wi < words.length - 1 ? <span className="rchar rspace">&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  );
}