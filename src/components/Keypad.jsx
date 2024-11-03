// Keypad.js
import React from "react";

const Keypad = ({ updateQuantity }) => {
  const handleClick = (num) => {
    updateQuantity(num);
  };

  return (
    <div className="keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
        <button key={num} onClick={() => handleClick(num)}>{num}</button>
      ))}
    </div>
  );
};

export default Keypad;
