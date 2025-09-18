// BpmnEditor.jsx
import React, { useRef, useEffect, useState } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import { saveAs } from 'file-saver';

/**
 * BPMN editor with file loading and export built in.
 * - Users can drag a BPMN file onto the file input to load a diagram.
 * - Users can click "Export BPMN XML" to download the current diagram.
 */
export default function BpmnEditor() {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // initialize the modeler once
    modelerRef.current = new Modeler({
      container: containerRef.current,
      keyboard: { bindTo: document }
    });

    // start with an empty diagram
    modelerRef.current.createDiagram().then(() => {
      setIsReady(true);
    }).catch(err => {
      console.error('Error creating diagram', err);
    });

    // clean up on unmount
    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // handle file loading
  const handleFileChange = async event => {
    const file = event.target.files[0];
    if (file && modelerRef.current) {
      const xml = await file.text();
      try {
        await modelerRef.current.importXML(xml);
      } catch (err) {
        console.error('Error importing BPMN XML', err);
      }
    }
  };

  // export current diagram to XML and download it
  const exportXml = async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml], { type: 'application/xml' });
      saveAs(blob, 'diagram.bpmn');
    } catch (err) {
      console.error('Error exporting BPMN XML', err);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '8px' }}>
        <input type="file" accept=".bpmn,.xml" onChange={handleFileChange} />
        <button onClick={exportXml} disabled={!isReady}>
          Export BPMN XML
        </button>
      </div>
     <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
