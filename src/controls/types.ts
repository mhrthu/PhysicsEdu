export type ControlDescriptor =
  | SliderDescriptor
  | ToggleDescriptor
  | DropdownDescriptor
  | ButtonDescriptor;

export interface SliderDescriptor {
  type: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export interface ToggleDescriptor {
  type: 'toggle';
  key: string;
  label: string;
  defaultValue: boolean;
}

export interface DropdownDescriptor {
  type: 'dropdown';
  key: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

export interface ButtonDescriptor {
  type: 'button';
  key: string;
  label: string;
}
