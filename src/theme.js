export const colors = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E6EAF0',
  track: '#EDF1F5',
  text: '#202B3C',
  muted: '#758195',
  faint: '#A3ACBA',
  green: '#36B985',
  greenDark: '#2A9D70',
  greenSoft: '#EAF7F1',
  greenText: '#1E7F5A',
  red: '#E05252',
  redSoft: '#FDEEEE',
  redText: '#B83A3A',
  blue: '#4C7CF0',
  blueSoft: '#EDF2FE',
  orange: '#EE8C2C',
  orangeSoft: '#FEF3E6',
  purple: '#8366E8',
  purpleSoft: '#F2EEFE',
};

/** Icon tile / avatar tones: [soft background, strong foreground]. */
export const tones = {
  green: [colors.greenSoft, colors.greenText],
  blue: [colors.blueSoft, colors.blue],
  orange: [colors.orangeSoft, colors.orange],
  purple: [colors.purpleSoft, colors.purple],
  red: [colors.redSoft, colors.redText],
  gray: [colors.track, colors.muted],
};

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const radius = { sm: 12, md: 14, lg: 16, xl: 22 };

export const space = { gutter: 20 };

export const shadow = {
  shadowColor: '#202B3C',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const shadowSoft = {
  shadowColor: '#202B3C',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
};
