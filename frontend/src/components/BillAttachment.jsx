import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billsAPI } from '../services/api';
import { Paperclip, Upload, X, FileText, Image, Eye, Trash2, Plus } from 'lucide-react';
import useThemeStore from '../store/themeStore';

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImage(mime) { return mime && mime.startsWith('image/'); }
function isPDF(mime)   { return mime === 'application/pdf'; }

/* ── Inline badge shown on transaction row ─────────────────────────────── */
export function BillBadge({ txId, onClick }) {
  const { data } = useQuery({
    queryKey: ['bills', txId],
    queryFn: () => billsAPI.getAll(txId).then(r => r.data.bills),
    staleTime: 30000,
  });
  const count = data?.length || 0;
  if (count === 0) return null;
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title="View bills" style={{
      display:'inline-flex', alignItems:'center', gap:3,
      padding:'2px 7px', borderRadius:20, fontSize:11, fontWeight:700,
      background:'rgba(139,92,246,.15)', color:'#8B5CF6', border:'1px solid rgba(139,92,246,.25)',
      cursor:'pointer',
    }}>
      <Paperclip size={10}/> {count}
    </button>
  );
}

/* ── Full modal ─────────────────────────────────────────────────────────── */
export default function BillAttachment({ txId, txName, onClose, skipLabel }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null); // { url, mime, name }
  const [uploadErr, setUploadErr] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bills', txId],
    queryFn: () => billsAPI.getAll(txId).then(r => r.data.bills),
  });
  const bills = data || [];

  const uploadMut = useMutation({
    mutationFn: (file) => billsAPI.upload(txId, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills', txId] }); setUploadErr(''); },
    onError: () => setUploadErr('Upload failed. Max 20MB. Allowed: JPG, PNG, PDF.'),
  });

  const deleteMut = useMutation({
    mutationFn: (billId) => billsAPI.delete(billId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills', txId] }),
  });

  const handleFiles = (files) => {
    setUploadErr('');
    const allowed = ['image/jpeg','image/png','image/jpg','image/webp','application/pdf'];
    for (const f of files) {
      if (!allowed.includes(f.type)) { setUploadErr(`${f.name}: only JPG, PNG, WebP, PDF allowed`); continue; }
      if (f.size > 20 * 1024 * 1024) { setUploadErr(`${f.name}: max 20MB`); continue; }
      uploadMut.mutate(f);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles([...e.dataTransfer.files]);
  };

  const token = localStorage.getItem('tracksy_token');
  const fileUrl = (bill) => `${billsAPI.fileUrl(bill.id)}?t=${token}`;

  const surf  = isDark ? '#111827' : '#fff';
  const surf2 = isDark ? '#1E2A3A' : '#F8FAFF';
  const bord  = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
  const txt   = isDark ? '#fff' : '#111';
  const txt2  = isDark ? 'rgba(255,255,255,.5)' : '#666';

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:200, backdropFilter:'blur(4px)' }}/>

      {/* Modal */}
      <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:201, padding:16 }}>
        <div style={{ background:surf, borderRadius:24, width:'100%', maxWidth:480, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.35)', border:`1px solid ${bord}` }}>

          {/* Header */}
          <div style={{ padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:txt, display:'flex', alignItems:'center', gap:8 }}>
                <Paperclip size={18} color="#8B5CF6"/> Bill Attachments
              </div>
              <div style={{ fontSize:12, color:txt2, marginTop:2 }}>{txName}</div>
            </div>
            {skipLabel ? (
              <button onClick={onClose} style={{ padding:'6px 14px', borderRadius:10, background:surf2, border:`1px solid ${bord}`, fontSize:12, fontWeight:700, color:txt2, cursor:'pointer' }}>
                {skipLabel}
              </button>
            ) : (
              <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:surf2, border:`1px solid ${bord}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color={txt2}/>
              </button>
            )}
          </div>

          {/* Drop zone */}
          <div style={{ padding:'16px 20px 0', flexShrink:0 }}>
            <div
              onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragging ? '#8B5CF6' : bord}`,
                borderRadius:16, padding:'20px 16px', textAlign:'center', cursor:'pointer',
                background: dragging ? 'rgba(139,92,246,.08)' : surf2,
                transition:'all .15s',
              }}
            >
              <Upload size={28} color={dragging ? '#8B5CF6' : txt2} style={{ marginBottom:8 }}/>
              <div style={{ fontSize:14, fontWeight:600, color:dragging ? '#8B5CF6' : txt, marginBottom:4 }}>
                {uploadMut.isPending ? 'Uploading…' : 'Drop bill here or click to browse'}
              </div>
              <div style={{ fontSize:12, color:txt2 }}>JPG · PNG · PDF · Max 20MB</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display:'none' }}
              onChange={e => handleFiles([...e.target.files])}/>
            {uploadErr && <div style={{ marginTop:8, fontSize:12, color:'#EF4444', fontWeight:600 }}>{uploadErr}</div>}
          </div>

          {/* Bills list */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
            {isLoading && (
              <div style={{ textAlign:'center', padding:24, color:txt2, fontSize:13 }}>Loading…</div>
            )}
            {!isLoading && bills.length === 0 && (
              <div style={{ textAlign:'center', padding:'24px 0', color:txt2 }}>
                <FileText size={36} style={{ marginBottom:10, opacity:.4 }}/>
                <div style={{ fontSize:13 }}>No bills attached yet</div>
              </div>
            )}
            {bills.map(bill => (
              <div key={bill.id} style={{ display:'flex', alignItems:'center', gap:12, background:surf2, borderRadius:14, padding:'12px 14px', border:`1px solid ${bord}` }}>
                {/* Thumb / icon */}
                <div style={{ width:44, height:44, borderRadius:10, background:isImage(bill.mime_type)?'transparent':'rgba(139,92,246,.12)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${bord}` }}>
                  {isImage(bill.mime_type)
                    ? <img src={`${fileUrl(bill)}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <FileText size={22} color="#8B5CF6"/>
                  }
                </div>
                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{bill.original_name}</div>
                  <div style={{ fontSize:11, color:txt2, marginTop:2 }}>
                    {fmtSize(bill.file_size)} · {new Date(bill.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <a href={fileUrl(bill)} target="_blank" rel="noopener noreferrer" title="View"
                    style={{ width:30, height:30, borderRadius:8, background:'rgba(139,92,246,.12)', border:'1px solid rgba(139,92,246,.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', textDecoration:'none' }}>
                    <Eye size={14} color="#8B5CF6"/>
                  </a>
                  <button onClick={()=>{ if(window.confirm('Delete this bill?')) deleteMut.mutate(bill.id); }} title="Delete"
                    style={{ width:30, height:30, borderRadius:8, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Trash2 size={14} color="#EF4444"/>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 20px 16px', borderTop:`1px solid ${bord}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span style={{ fontSize:12, color:txt2 }}>{bills.length} bill{bills.length !== 1 ? 's' : ''} attached</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>fileRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background:'#8B5CF6', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                <Plus size={14}/> Add Bill
              </button>
              {skipLabel && (
                <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:10, border:`1px solid ${bord}`, background:surf2, color:txt, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <div onClick={()=>setPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <img src={preview.url} alt={preview.name} style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:12, objectFit:'contain' }}/>
          <button onClick={()=>setPreview(null)} style={{ position:'absolute', top:20, right:20, width:40, height:40, borderRadius:12, background:'rgba(255,255,255,.15)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <X size={20} color="#fff"/>
          </button>
        </div>
      )}
    </>
  );
}
