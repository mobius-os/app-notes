import {
  ArrowLeft,
  Check,
  ColorTheme,
  Edit,
  File,
  FileDocument,
  FileImage,
  Lock,
  Paperclip,
  Pin,
  Plus,
  Search,
  SquareCheckCheckboxChecked,
  Trash,
} from '@openai/apps-sdk-ui/components/Icon'

const SDK_ICONS = {
  pin: Pin,
  palette: ColorTheme,
  paperclip: Paperclip,
  image: FileImage,
  file: File,
  trash: Trash,
  lock: Lock,
  back: ArrowLeft,
  edit: Edit,
  checklist: SquareCheckCheckboxChecked,
  note: FileDocument,
  check: Check,
  search: Search,
  plus: Plus,
}

export function Icon({ name, size = 17, ...props }) {
  const SdkIcon = SDK_ICONS[name]
  if (SdkIcon) {
    return <SdkIcon width={size} height={size} aria-hidden="true" {...props} />
  }

  // The SDK has no unlocked-padlock counterpart yet. Keep this one semantic
  // exception paired with the SDK lock until the family gains an exact icon.
  if (name === 'unlock') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.2-2.4" />
      </svg>
    )
  }
  return null
}
