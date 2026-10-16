/**
 * Only switchable annunciators and unused equipment variants start hidden.
 * FlightGear's `glare` names also include permanent lettering and an entire
 * opaque cockpit shell (`pedestal_low_glare.001`), not just light effects.
 */
export function hideStaticCockpitPart(name: string) {
  return /(?:Btn[12]{1,2}[A-Z](?:\.|$)|_led(?:\.|$)|^audio_.*_glare(?:\.|$)|_on(?:\.|$)|_lit(?:\.|$)|\.ind(?:\.|$)|\.dash$|\.fmgc$|mcdu_ann_|_sgn\.|^hud|^EFB_|^glare_ovh_eng_iae|^ovh_eng_iae|^fcu_hud|^fcu_labels_hud|^clock_display_illuminated|^engine_fire_|^engine_fault_|_unlk$|^prio_capt\.|^prio_fo\.|^prio_fo_fo$)/i.test(name)
}
