import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {MAXIMUM_STAT_MOD_AMOUNT} from "../../../../../data/constants";
import {ArmorSlot} from "../../../../../data/enum/armor-slot";
import {ConfigurationService} from "../../../../../services/configuration.service";
import {
  ArmorPerkOrSlot,
  ArmorPerkOrSlotNames
} from "../../../../../data/enum/armor-stat";
import {DestinyClass, DestinyEnergyType} from "bungie-api-ts/destiny2";
import {InventoryService} from "../../../../../services/inventory.service";
import {DatabaseService} from "../../../../../services/database.service";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {environment} from "../../../../../../environments/environment";

@Component({
  selector: 'app-slot-limitation-selection',
  templateUrl: './slot-limitation-selection.component.html',
  styleUrls: ['./slot-limitation-selection.component.scss']
})
export class SlotLimitationSelectionComponent implements OnInit, OnDestroy {
  readonly featureDisabled = !environment.featureFlags.enableModslotLimitation;
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlotNames = ArmorPerkOrSlotNames;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;
  readonly ModRange = new Array(MAXIMUM_STAT_MOD_AMOUNT + 1);
  selection: number = MAXIMUM_STAT_MOD_AMOUNT;

  @Input()
  slot: ArmorSlot = ArmorSlot.ArmorSlotHelmet;
  @Output()
  possible: EventEmitter<boolean> = new EventEmitter<boolean>();

  isPossible: boolean = true;
  configSelectedClass: DestinyClass = DestinyClass.Titan;
  armorPerk: ArmorPerkOrSlot = ArmorPerkOrSlot.None;
  armorPerkLock: boolean = false;
  maximumModSlots: number = 5;

  hoveredSlot: number = -1;

  disabled: boolean = false;

  constructor(public config: ConfigurationService, public inventory: InventoryService, private db: DatabaseService) {
  }

  public async runPossibilityCheck() {
    const mustCheckArmorPerk = this.armorPerkLock && this.armorPerk != ArmorPerkOrSlot.None;
    if (mustCheckArmorPerk ) {
      var applicablePerk = await this.db.inventoryArmor
        .where("clazz").equals(this.configSelectedClass)
        .and(f => f.slot == this.slot)
        .and(f => f.perk == this.armorPerk)
        .count()
      this.isPossible = (applicablePerk > 0);
    } else {
      this.isPossible = true;
    }
    this.possible.next(this.isPossible);
  }

  get slotName(): string {
    switch (this.slot) {
      case ArmorSlot.ArmorSlotHelmet:
        return "Helmet";
      case ArmorSlot.ArmorSlotGauntlet:
        return "Gauntlet";
      case ArmorSlot.ArmorSlotChest:
        return "Chest";
      case ArmorSlot.ArmorSlotLegs:
        return "Leg";
      case ArmorSlot.ArmorSlotClass:
        return "Class Item";
      default:
        return "";
    }
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async c => {
        var mustRunPossibilityCheck =
          this.configSelectedClass != c.characterClass as unknown as DestinyClass
          || this.selection != c.maximumModSlots[this.slot].value
          || this.armorPerk != c.armorPerks[this.slot].value
          || this.armorPerkLock != c.armorPerks[this.slot].fixed
          || this.maximumModSlots != c.maximumModSlots[this.slot].value;

        this.configSelectedClass = c.characterClass as unknown as DestinyClass;
        this.selection = c.maximumModSlots[this.slot].value;
        this.armorPerk = c.armorPerks[this.slot].value;
        this.armorPerkLock = c.armorPerks[this.slot].fixed;
        this.maximumModSlots = c.maximumModSlots[this.slot].value;

        this.disabled = (await this.inventory.getExoticsForClass(c.characterClass))
          .filter(x => c.selectedExotics.indexOf(x.item.hash) > -1)
          .map(e => e.item.slot)
          .indexOf(this.slot) > -1;

        if (mustRunPossibilityCheck)
          await this.runPossibilityCheck();
      })
  }

  toggleArmorPerkLock() {
    this.config.modifyConfiguration(c => {
      c.armorPerks[this.slot].fixed = !c.armorPerks[this.slot].fixed;
    })
  }

  setArmorPerk(perk: ArmorPerkOrSlot) {
    if (this.armorPerk != perk)
      this.config.modifyConfiguration(c => {
        c.armorPerks[this.slot].value = perk;
      })
  }

  setValue(i: number) {
    if(this.featureDisabled) return;
    if (this.maximumModSlots == i)
      return;

    this.maximumModSlots = i;
    this.config.modifyConfiguration(c => c.maximumModSlots[this.slot].value = i);
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
