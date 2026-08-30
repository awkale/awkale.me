import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FacetSelect } from './facet-select'

/**
 * The control half of AWK-55. The combining rule is asserted without a DOM in
 * app/lib/facets.test.ts; what is worth testing HERE is the wiring that the pure
 * module cannot see — and it is worth testing because the bug this ticket fixed
 * was ENTIRELY wiring. The old chip row rendered, styled itself on click, and
 * reported nothing to anyone. It looked correct in a screenshot.
 *
 * So: does choosing an option report the new selection, does choosing a second
 * one WIDEN rather than replace, and does a value the control has no option for
 * survive both.
 */
const CONDUCTORS = [
  { name: 'Tara Simoncic', n: 53 },
  { name: 'Nicholas Armstrong', n: 12 },
]

function renderFacet(selected: string[] = []) {
  const onChange = vi.fn()

  render(
    <FacetSelect label="Conductor" plural="conductors" items={CONDUCTORS} selected={selected} onChange={onChange} />
  )

  return { onChange, field: screen.getByRole('combobox') }
}

async function open(field: HTMLElement) {
  // Through the disclosure rather than the field: the ComboBox's default
  // `menuTrigger` is 'input', so an empty query opens nothing.
  field.focus()
  fireEvent.click(screen.getByRole('button', { name: /Show all conductors/ }))

  return screen.findByRole('listbox')
}

describe('FacetSelect', () => {
  afterEach(cleanup)

  it('reports the chosen value rather than holding it privately', async () => {
    // The whole bug: React Aria gives an uncontrolled control its own selection
    // state, so the styling responds while the caller learns nothing.
    const { onChange, field } = renderFacet()
    await open(field)

    fireEvent.click(screen.getByRole('option', { name: /Tara Simoncic/ }))

    expect(onChange).toHaveBeenCalledWith(['Tara Simoncic'])
  })

  it('WIDENS to both when a second value is chosen', async () => {
    // Decision 1: OR within a facet. A single-select control would report only
    // the newest value here, and the table would narrow instead of widening.
    const { onChange, field } = renderFacet(['Tara Simoncic'])
    await open(field)

    fireEvent.click(screen.getByRole('option', { name: /Nicholas Armstrong/ }))

    expect(onChange).toHaveBeenCalledWith(['Tara Simoncic', 'Nicholas Armstrong'])
  })

  it('shows the absolute count on every option', async () => {
    // Never cross-filtered: 53 is a fact about the Performance history.
    const { field } = renderFacet(['Nicholas Armstrong'])
    await open(field)

    expect(screen.getByRole('option', { name: /Tara Simoncic/ }).textContent).toContain('53')
  })

  it('renders the current selection as removable tags', () => {
    const { onChange } = renderFacet(['Tara Simoncic'])

    fireEvent.click(screen.getByRole('button', { name: /Remove Tara Simoncic/ }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('renders a value it has no option for, and keeps it removable', () => {
    // `?conductor=Nobody` is honoured rather than dropped (decision 5). The tags
    // come from the URL rather than from the ComboBox's own value precisely so
    // this one is visible instead of silently absent.
    const { onChange } = renderFacet(['Nobody'])

    expect(screen.getByRole('button', { name: /Remove Nobody/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Remove Nobody/ }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('CARRIES an unknown value across a selection change', async () => {
    // `Nobody` must not fall out of the URL just because something else was
    // chosen — that is the same silent-ignore failure AWK-55 was filed about,
    // arriving from a different direction.
    //
    // It reports `Nobody` FIRST because React Aria keeps keys it has no item
    // for in its own value and hands them back in place. This assertion is
    // therefore doing double duty: the first run of it returned
    // ['Nobody', 'Tara Simoncic', 'Nobody'], because the component appended the
    // unknown values React Aria had already returned. Hence the union.
    const { onChange, field } = renderFacet(['Nobody'])
    await open(field)

    fireEvent.click(screen.getByRole('option', { name: /Tara Simoncic/ }))

    expect(onChange).toHaveBeenCalledWith(['Nobody', 'Tara Simoncic'])
  })

  it('offers every value with no query typed', async () => {
    const { field } = renderFacet()
    await open(field)

    expect(screen.getAllByRole('option')).toHaveLength(CONDUCTORS.length)
  })

  it('filters the options as the reader types', async () => {
    // React Aria's own contains-filter, deliberately left ON here — unlike
    // site-search.tsx, which switches it off to protect app/lib/search.ts's
    // ranking. There is no ranking to protect in a few dozen names.
    const { field } = renderFacet()
    await open(field)

    fireEvent.change(field, { target: { value: 'armstrong' } })

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Nicholas Armstrong12'])
  })

  it('KEEPS a selected value the typed query has filtered out of the list', async () => {
    // The subtle one, and the reason this file exists. Typing narrows the
    // collection, so at the moment of the second click the control cannot see
    // the first selection at all. If it reported only what it could see, the
    // reader would lose a filter they never touched — and would have no way to
    // tell, because the value they lost is not on screen to be missed.
    const { onChange, field } = renderFacet(['Tara Simoncic'])
    await open(field)

    fireEvent.change(field, { target: { value: 'armstrong' } })
    fireEvent.click(screen.getByRole('option', { name: /Nicholas Armstrong/ }))

    expect(onChange).toHaveBeenCalledWith(['Tara Simoncic', 'Nicholas Armstrong'])
  })

  it('deselects on a second click of the same option', async () => {
    // The other half of multi-select: the option list is the way back out, not
    // just the way in. The tags are a shortcut, not the only remover.
    const { onChange, field } = renderFacet(['Tara Simoncic'])
    await open(field)

    fireEvent.click(screen.getByRole('option', { name: /Tara Simoncic/ }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('drops the typed query when the popover closes', async () => {
    // The query SURVIVES a selection on purpose — choosing two matches of the
    // same search is the ordinary multi-select move — but it must not survive
    // the popover. Otherwise the next open shows last time's search with the
    // rest of the list hidden behind it, and a reader who once typed "arm" is
    // quietly told this orchestra has one conductor.
    const { field } = renderFacet()
    await open(field)

    fireEvent.change(field, { target: { value: 'tara' } })
    fireEvent.click(screen.getByRole('option', { name: /Tara Simoncic/ }))
    expect((field as HTMLInputElement).value).toBe('tara')

    fireEvent.keyDown(field, { key: 'Escape' })
    fireEvent.keyUp(field, { key: 'Escape' })

    expect((field as HTMLInputElement).value).toBe('')
  })

  it('catches focus when removing the LAST tag unmounts the group', async () => {
    // Otherwise focus lands on <body> and a keyboard reader restarts from the
    // top of the document. React Aria moves focus into the tag group as tags go,
    // which is also why facet-select.css must not hide the empty group.
    const { field } = renderFacet(['Tara Simoncic'])

    fireEvent.click(screen.getByRole('button', { name: /Remove Tara Simoncic/ }))

    expect(document.activeElement).toBe(field)
  })
})
