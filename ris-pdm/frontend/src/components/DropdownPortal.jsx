import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DropdownPortal = ({ anchorRef, isOpen, onClose, children, offsetY = 4, className = '' }) => {
  const portalRootRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.zIndex = '3000';
    el.className = className;
    portalRootRef.current = el;
    document.body.appendChild(el);
    setReady(true);

    const handleClickOutside = (e) => {
      if (!isOpen) return;
      const anchor = anchorRef?.current;
      if (anchor && (anchor.contains(e.target) || el.contains(e.target))) return;
      onClose?.();
    };

    document.addEventListener('mousedown', handleClickOutside);
    const handleReposition = () => {
      if (!isOpen || !anchorRef?.current || !portalRootRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const el = portalRootRef.current;
      el.style.top = `${window.scrollY + rect.bottom + offsetY}px`;
      el.style.left = `${window.scrollX + rect.left}px`;
      el.style.width = `${rect.width}px`;
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition);
      if (portalRootRef.current) document.body.removeChild(portalRootRef.current);
      setReady(false);
    };
  }, [anchorRef, isOpen, onClose, className, offsetY]);

  useEffect(() => {
    if (!isOpen || !anchorRef?.current || !portalRootRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const el = portalRootRef.current;
    el.style.top = `${window.scrollY + anchorRect.bottom + offsetY}px`;
    el.style.left = `${window.scrollX + anchorRect.left}px`;
    el.style.width = `${anchorRect.width}px`;
  }, [isOpen, anchorRef, offsetY, ready]);

  if (!isOpen || !portalRootRef.current || !ready) return null;

  return createPortal(children, portalRootRef.current);
};

export default DropdownPortal;


