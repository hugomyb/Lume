/** A small on/off pill switch, used in place of native checkboxes. */
export default function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      class="settings-toggle"
      classList={{ on: props.checked }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="settings-toggle-knob" />
    </button>
  );
}
