import React, { useState, useRef } from 'react';
import './CargarDocumentos.css';

const CargarDocumentos = () => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = () => {
    alert('Funcionalidad de backend pendiente. Los archivos están listos para enviarse.');
  };

  return (
    <div className="cargar-documentos-container">
      <h1 className="page-title">Cargar Documentos</h1>
      <p className="page-subtitle">Sube los documentos necesarios al sistema. (Interfaz sin conexión al backend)</p>

      <div 
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <div className="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h3>Arrastra y suelta tus archivos aquí</h3>
        <p>O haz clic para seleccionar archivos desde tu dispositivo</p>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <h3>Archivos Seleccionados ({files.length})</h3>
          <ul className="file-items">
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <div className="file-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                </div>
                <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          
          <button className="upload-submit-btn" onClick={handleUpload}>
            Subir Documentos
          </button>
        </div>
      )}
    </div>
  );
};

export default CargarDocumentos;
