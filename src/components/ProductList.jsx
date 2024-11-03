// ProductList.js
import React from "react";

const products = [
  { id: 1, name: "Apple", price: 1.5 },
  { id: 2, name: "Banana", price: 0.5 },
  { id: 3, name: "Orange", price: 1.0 },
  // Add more items as needed
];

const ProductList = ({ addToCart }) => {
  return (
    <div className="product-list">
      <h3>Products</h3>
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => addToCart(product)}
          className="product-item"
        >
          {product.name} - ${product.price}
        </button>
      ))}
    </div>
  );
};

export default ProductList;
