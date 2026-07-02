import { createContext, useState, useContext, useCallback } from "react";
import AlertModal from "../components/AlertModal";

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert debe usarse dentro de AlertProvider");
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    showCancel: false,
    confirmText: "Aceptar",
    cancelText: "Cancelar",
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title || "",
        message,
        type: options.type || "info",
        showCancel: false,
        confirmText: options.confirmText || "Aceptar",
        cancelText: "Cancelar",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title || "Confirmar",
        message,
        type: options.type || "warning",
        showCancel: true,
        confirmText: options.confirmText || "Aceptar",
        cancelText: options.cancelText || "Cancelar",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  // Cierra el modal sin confirmar → resuelve con false
  const closeAlert = useCallback(() => {
    setAlertState((prev) => {
      if (prev.onCancel) prev.onCancel();
      return {
        ...prev,
        isOpen: false,
        onConfirm: null,
        onCancel: null,
      };
    });
  }, []);

  // El usuario confirmó → resuelve con true, limpia handlers ANTES de cerrar
  // para que closeAlert (llamado después desde AlertModal) no llame onCancel
  const handleConfirm = useCallback(() => {
    setAlertState((prev) => {
      if (prev.onConfirm) prev.onConfirm();
      return {
        ...prev,
        isOpen: false,
        onConfirm: null,
        onCancel: null,
      };
    });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        onConfirm={handleConfirm}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        showCancel={alertState.showCancel}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
      />
    </AlertContext.Provider>
  );
};
