// Checkout.js
import React from "react";

const Checkout = ({ total, handleCheckout }) => {
  return (
    <div className="checkout">
      <h3>Checkout</h3>
      <p>Total: ${total.toFixed(2)}</p>
      <button onClick={handleCheckout} className="checkout-button">
        Complete Sale
      </button>
    </div>
  );
};

export default Checkout;
