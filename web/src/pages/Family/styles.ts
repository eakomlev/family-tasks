import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'

export const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  h1 { margin: 0; }
`

export const EditLink = styled(Link)`
  color: var(--accent);
  text-decoration: none;
  font-weight: 700;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 0.3rem; }
`

export const SectionTabs = styled.nav`
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 999px;
  background: var(--surface);
`

export const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.65rem;
  padding: 0.45rem 0.7rem;
  border: 0;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'var(--tabbar-active-bg)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--tabbar-active-text)' : 'var(--muted)')};
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`

export const Count = styled.span`
  display: inline-grid;
  place-items: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 900;
`

const iconStyles = css`
  display: grid;
  place-items: center;
  flex: none;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: 1rem;
  background: var(--accent-soft);
  color: var(--accent);

  svg { width: 1.45rem; height: 1.45rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
`

export const IconTile = styled.span`${iconStyles}`

export const ConnectionIntro = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid transparent;
  border-radius: 1.25rem;
  background: var(--accent-soft);

  > div:last-child { display: grid; gap: 0.15rem; }
  strong { font-size: 1.05rem; font-weight: 900; }
  span { color: var(--muted); font-size: 0.88rem; line-height: 1.35; }
`

export const FamilyHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 1rem 0 0.7rem;

  h2 { margin: 0; font-size: 1.1rem; }
`

export const ConnectionList = styled.div`
  display: grid;
  gap: 0.7rem;
`

export const ConnectionContent = styled.div`
  display: grid;
  align-content: start;
  gap: 0.8rem;
`

export const Panel = styled.section`
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1.25rem;
  background: var(--surface);
  box-shadow: var(--card-shadow);

  .panel-heading { display: grid; gap: 0.2rem; }
  .panel-heading h2 { margin: 0; font-size: 1.15rem; }
  .panel-heading p { margin: 0; color: var(--muted); font-size: 0.9rem; }
  .surname-summary { display: grid; gap: 0.2rem; }
  .surname-summary small { color: var(--muted); }
`

export const FamilyIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  > div:nth-child(2) { display: grid; gap: 0.15rem; flex: 1; min-width: 0; }
`

export const FamilyName = styled.strong`
  overflow-wrap: anywhere;
  font-size: 1.05rem;
  font-weight: 900;
`

export const Members = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Member = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.55rem;
  padding: 0.45rem 0;
  border-top: 1px solid var(--card-border, var(--border));
  color: inherit;
  text-decoration: none;

  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 0.5rem; }
  &:hover .chevron { color: var(--accent); transform: translateX(2px); }
`

export const MemberMeta = styled.span`
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.1rem;
`

export const MemberName = styled.strong`
  overflow-wrap: anywhere;
  font-weight: 800;
`

export const StatusText = styled.span`
  color: var(--muted);
  font-size: 0.84rem;
`

export const EmptyState = styled.div`
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  padding: 1.5rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  text-align: center;

  strong { font-size: 1.05rem; font-weight: 900; }
  > span:last-child { max-width: 20rem; color: var(--muted); font-size: 0.9rem; line-height: 1.4; }
`

export const RequestsLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1.15rem;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: inherit;
  text-decoration: none;

  > span:nth-child(2) { display: grid; gap: 0.1rem; flex: 1; }
  strong { font-weight: 900; }
  small { color: var(--muted); font-size: 0.82rem; }
  .chevron { color: var(--muted); font-size: 1.25rem; transition: transform 0.15s, color 0.15s; }
  &:hover .chevron { color: var(--accent); transform: translateX(2px); }
  &:hover { border-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`

export const FamilyAction = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 4rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1.15rem;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  > span:nth-child(2) { display: grid; gap: 0.1rem; flex: 1; }
  strong { font-weight: 900; }
  small { color: var(--muted); font-size: 0.82rem; }
  .chevron { color: var(--muted); font-size: 1.25rem; transition: transform 0.15s, color 0.15s; }
  &:hover .chevron { color: var(--accent); transform: translateX(2px); }
  &:hover { border-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`

export const FamilyCode = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1.1rem;
  background: var(--surface);

  > div { display: grid; gap: 0.2rem; }
  small { color: var(--muted); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; }
  code { font: inherit; font-size: 1.2rem; font-weight: 900; letter-spacing: 0.12em; }
  > span { color: var(--muted); font-size: 0.82rem; text-align: right; }
`

export const FamilyMemberLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1.1rem;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: inherit;
  text-decoration: none;

  &:hover { border-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  > span:nth-child(2) { display: grid; flex: 1; min-width: 0; gap: 0.1rem; }
  .chevron { color: var(--muted); font-size: 1.25rem; transition: transform 0.15s, color 0.15s; }
  &:hover .chevron { color: var(--accent); transform: translateX(2px); }
`
