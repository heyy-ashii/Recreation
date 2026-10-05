import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal, PageSpinner, Spinner, StatusBadge } from '../../components/ui'
import { useUi } from '../../context/UiContext'
import { api, errorMessage } from '../../lib/api'
import { useCategories, useProgram, usePrograms } from '../../lib/queries'
import type { Program, ProgramStatus } from '../../lib/types'
import { usePageMeta } from '../../lib/usePageMeta'
import { formatDate, optimizeImage } from '../../lib/utils'

type Draft = {
  title: string
  category: string
  type: string
  organizer: string
  venue: string
  about: string
  registrationLink: string
  contact: string
  imageurls: string[]
  tags: string
  status: ProgramStatus
  deadline: string
  eventDate: string
}

const toInputDate = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '')

const toDraft = (p?: Program): Draft => ({
  title: p?.title ?? '',
  category: p?.category ?? '',
  type: p?.type ?? '',
  organizer: p?.organizer ?? '',
  venue: p?.venue ?? '',
  about: p?.about ?? '',
  registrationLink: p?.registrationLink ?? '',
  contact: p?.contact ?? '',
  imageurls: p?.imageurls ?? [],
  tags: p?.tags.join(', ') ?? '',
  status: p?.status ?? 'Live',
  deadline: toInputDate(p?.deadline),
  eventDate: toInputDate(p?.eventDate),
})

function ProgramForm({ initial, onClose }: { initial?: Program; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useUi()
  const { data: categories } = useCategories()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean) }
      return initial ? api(`/programs/${initial._id}`, { method: 'PATCH', body }) : api('/programs', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      qc.invalidateQueries({ queryKey: ['program'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast(initial ? 'Program updated' : 'Program published')
      onClose()
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const fd = new FormData()
    Array.from(files).forEach((f) => fd.append('images', f))
    setUploading(true)
    try {
      const res = await api<{ data: { urls: string[] } }>('/upload', { method: 'POST', body: fd })
      set('imageurls', [...draft.imageurls, ...res.data.urls])
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const addUrl = () => {
    try {
      new URL(imageUrl)
      set('imageurls', [...draft.imageurls, imageUrl.trim()])
      setImageUrl('')
    } catch {
      toast('Enter a valid image URL', 'error')
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="p-title">Title *</label>
        <input id="p-title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="p-category">Category *</label>
          <input id="p-category" className="input" list="category-options" value={draft.category} onChange={(e) => set('category', e.target.value)} required />
          <datalist id="category-options">{categories?.map((c) => <option key={c.name} value={c.name} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="p-type">Type</label>
          <input id="p-type" className="input" value={draft.type} onChange={(e) => set('type', e.target.value)} placeholder="e.g. Call for Entries" />
        </div>
        <div>
          <label className="label" htmlFor="p-status">Status</label>
          <select id="p-status" className="input" value={draft.status} onChange={(e) => set('status', e.target.value as ProgramStatus)}>
            <option>Live</option>
            <option>Recent</option>
            <option>Closed</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="p-organizer">Organizer</label>
          <input id="p-organizer" className="input" value={draft.organizer} onChange={(e) => set('organizer', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-venue">Venue</label>
          <input id="p-venue" className="input" value={draft.venue} onChange={(e) => set('venue', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-deadline">Deadline</label>
          <input id="p-deadline" type="date" className="input" value={draft.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-event">Event date</label>
          <input id="p-event" type="date" className="input" value={draft.eventDate} onChange={(e) => set('eventDate', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-link">Registration link</label>
          <input id="p-link" type="url" className="input" value={draft.registrationLink} onChange={(e) => set('registrationLink', e.target.value)} placeholder="https://" />
        </div>
        <div>
          <label className="label" htmlFor="p-tags">Tags (comma separated)</label>
          <input id="p-tags" className="input" value={draft.tags} onChange={(e) => set('tags', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-contact">Contact</label>
        <input id="p-contact" className="input" value={draft.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Phone / email / WhatsApp" />
      </div>
      <div>
        <label className="label" htmlFor="p-about">About</label>
        <textarea id="p-about" className="input min-h-36" value={draft.about} onChange={(e) => set('about', e.target.value)} />
      </div>
      <div>
        <span className="label">Images</span>
        <div className="flex flex-wrap gap-2">
          {draft.imageurls.map((u, i) => (
            <div key={u + i} className="relative">
              <img src={optimizeImage(u, 160)} alt="" className="size-20 rounded-lg object-cover" />
              <button type="button" className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white" onClick={() => set('imageurls', draft.imageurls.filter((_, j) => j !== i))} aria-label="Remove image">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-brand hover:text-brand dark:border-neutral-700">
            {uploading ? <Spinner /> : <ImagePlus className="size-6" />}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={uploading} aria-label="Upload images" />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder="…or paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} aria-label="Image URL" />
          <button type="button" className="btn-outline" onClick={addUrl} disabled={!imageUrl}>Add</button>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={save.isPending || uploading}>{save.isPending && <Spinner className="size-4" />} {initial ? 'Save changes' : 'Publish'}</button>
      </div>
    </form>
  )
}

function EditProgram({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useProgram(id)
  if (isLoading || !data) return <PageSpinner />
  return <ProgramForm initial={data} onClose={onClose} />
}

export default function Programs() {
  usePageMeta('Programs · Admin')
  const qc = useQueryClient()
  const { toast } = useUi()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null | undefined>(params.get('new') ? null : undefined)
  const [deleting, setDeleting] = useState<Program | null>(null)
  const { data, isLoading } = usePrograms({ q: q.trim() || undefined, limit: 100 })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/programs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast('Program deleted')
      setDeleting(null)
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })

  const closeForm = () => {
    setEditing(undefined)
    if (params.get('new')) setParams({}, { replace: true })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-sm text-neutral-500">{data ? `${data.total} total` : ' '}</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(null)}><Plus className="size-4" /> Add program</button>
      </div>
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input className="input pl-9" placeholder="Search programs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search programs" />
      </div>
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data?.data.programs.map((p) => (
                <tr key={p._id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageurls[0] ? <img src={optimizeImage(p.imageurls[0], 96)} alt="" className="size-10 rounded-lg object-cover" loading="lazy" /> : <div className="size-10 rounded-lg bg-neutral-200 dark:bg-neutral-800" />}
                      <span className="line-clamp-2 max-w-sm font-medium">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(p.deadline)}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link to={`/programs/${p._id}`} target="_blank" className="btn-ghost p-2" aria-label={`View ${p.title}`}><ExternalLink className="size-4" /></Link>
                      <button className="btn-ghost p-2" onClick={() => setEditing(p._id)} aria-label={`Edit ${p.title}`}><Pencil className="size-4" /></button>
                      <button className="btn-ghost p-2 text-red-600" onClick={() => setDeleting(p)} aria-label={`Delete ${p.title}`}><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.programs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-500">No programs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== undefined} onClose={closeForm} title={editing ? 'Edit program' : 'Add program'} wide>
        {editing === null && <ProgramForm onClose={closeForm} />}
        {editing && <EditProgram id={editing} onClose={closeForm} />}
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete program?">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">“{deleting?.title}” will be removed from the site permanently.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
          <button className="btn-danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting._id)}>{remove.isPending && <Spinner className="size-4" />} Delete</button>
        </div>
      </Modal>
    </div>
  )
}
