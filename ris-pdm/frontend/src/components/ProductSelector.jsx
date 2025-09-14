import React, { useState, useRef, useEffect } from 'react';
import { projectsConfig } from '../config/branding';

const ProductSelector = ({ selectedProduct, onProductChange, products = [], className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Use projects from config or provided products
  const productList = products.length > 0 ? products : projectsConfig;
  const currentProduct = productList.find(p => p.id === selectedProduct) || productList[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (product) => {
    onProductChange(product.id);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Project
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <div className="flex-shrink-0 w-8 h-8 mr-3">
              {currentProduct.icon ? (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: currentProduct.color || '#3B82F6' }}
                >
                  <span className="text-lg">
                    {currentProduct.icon}
                  </span>
                </div>
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: currentProduct.color || '#3B82F6' }}
                >
                  <span className="text-white text-xs font-semibold">
                    {currentProduct.abbreviation || currentProduct.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {currentProduct.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {currentProduct.description}
              </div>
            </div>
          </div>
          <svg
            className={`ml-2 h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {productList.map((product) => (
              <li
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className={`cursor-pointer select-none px-3 py-2 hover:bg-gray-100 ${
                  selectedProduct === product.id ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                }`}
                role="option"
                aria-selected={selectedProduct === product.id}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 mr-3">
                    {product.icon ? (
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: product.color || '#3B82F6' }}
                      >
                        <span className="text-lg">
                          {product.icon}
                        </span>
                      </div>
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: product.color || '#3B82F6' }}
                      >
                        <span className="text-white text-xs font-semibold">
                          {product.abbreviation || product.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {product.description}
                    </div>
                    {product.lastUpdate && (
                      <div className="text-xs text-gray-400 mt-1">
                        Last updated: {product.lastUpdate} • {product.process}
                      </div>
                    )}
                  </div>
                  {selectedProduct === product.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProductSelector;