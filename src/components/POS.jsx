// POS.js
import React, { useState } from "react";
import ProductList from "./ProductList";
import Cart from "./Cart";
import Keypad from "./Keypad";
import Checkout from "./Checkout";
import "./POS.css"; // Optional styling
import SearchAndAddItem from "./SearchAndAddItem"; 
import { Box, Typography, Grid } from '@mui/material'; // Ensure Grid is imported here

const POS = () => {
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Add product to cart
  const addToCart = (product) => {
    const existingProduct = cart.find(item => item.id === product.id);
    if (existingProduct) {
      existingProduct.quantity += 1;
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    updateTotal();
  };

  // Update total cost
  const updateTotal = () => {
    const newTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    setTotal(newTotal);
  };

  // Update quantity from keypad
  const updateQuantity = (quantity) => {
    if (selectedProduct) {
      const updatedCart = cart.map((item) =>
        item.id === selectedProduct.id ? { ...item, quantity } : item
      );
      setCart(updatedCart);
      updateTotal();
    }
  };

  // Handle checkout and reset cart
  const handleCheckout = () => {
    alert(`Total Amount: ${total}`);
    setCart([]);
    setTotal(0);
  };

  return (
    
    <div className="pos-container">
           
          <SearchAndAddItem />
         
      <ProductList addToCart={addToCart} />
      <Cart
        cart={cart}
        setSelectedProduct={setSelectedProduct}
        total={total}
      />
      <Keypad updateQuantity={updateQuantity} />
      <Checkout total={total} handleCheckout={handleCheckout} />
    </div>
  );
};

export default POS;
