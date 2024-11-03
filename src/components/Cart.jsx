// Cart.js
import React from "react";

const Cart = ({ cart, setSelectedProduct, total }) => {
  return (
    <div className="cart">
      <h3>Cart</h3>
      <ul>
        {cart.map((item) => (
          <li key={item.id} onClick={() => setSelectedProduct(item)}>
            {item.name} x {item.quantity} = ${(item.price * item.quantity).toFixed(2)}
          </li>
        ))}
      </ul>
      <h4>Total: ${total.toFixed(2)}</h4>
    </div>
  );
};

export default Cart;
