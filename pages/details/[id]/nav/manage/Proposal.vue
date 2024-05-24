<template>
    <div>
      <UiHeader>
        <div class="header">
          <div class="main_header__title">
            Create NAV Proposal
          </div>
          <div class="last-update">
            Last Updates on 22 04 24
          </div>
        </div>
      </UiHeader>
      <div class="main_card">
        <v-form ref="form" v-model="formIsValid">
          <v-container fluid>
            <div class="section">
              <v-row>
                <div class="form-col">
                  <v-label class="label_required">
                    Proposal Title
                  </v-label>
                  <div class="sub-text">
                    <v-label >
                      MAX 150
                    </v-label>
                    <v-icon icon="mdi-circle-outline" size="15" />
                  </div>
                </div>
              </v-row>
              <v-row>
                <v-text-field
                  v-model="method.positionName"
                  placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                  required
                />
              </v-row>
            </div>
            <v-row >
              <v-label class="label_required">
                Management
              </v-label>
            </v-row>
            <v-row>
              <div class="management">
                <div class="management__card">
                  <div class="management__row">
                    <div>
                      Allow manager to keep updating NAV based on these methods
                    </div>
                    <v-switch
                      v-model="method"
                      color="primary"
                      hide-details
                      inset
                    ></v-switch>
                  </div>
                  <div class="d-inline-block">
                    <div class="management__info">
                      <v-icon color="primary" icon="mdi-alert-circle-outline" />
                      <div>
                        All previous manager permissions related to NAV will be revoked.
                      </div>
                    </div>
                  </div>
                </div>
                <div class="management__card-no-margin">
                  <div class="management__row">
                    <div>
                      Collect management fees upon NAV proposal execution
                    </div>
                    <v-switch
                      v-model="method"
                      color="primary"
                      hide-details
                      inset
                    ></v-switch>
                  </div>
                </div>
              </div>
            </v-row>
            <v-row >
              <v-label class="label_required proposal">
                Proposal Description
              </v-label>
            </v-row>
            <v-textarea
              :placeholder="`Type here`"
              hide-details
              required
            />
            <v-row>
              <div class="changes">
                <div>
                  Proposal Methods
                </div>
                <div>
                 •
                </div>
                <div class="text-success">
                  3
                </div>
                <div>
                  Changes
                </div>
              </div>
            </v-row>
            <v-row>
              <div class="action-buttons">
                <v-btn
                  class="text-secondary"
                  variant="outlined"
                  :disabled="true"
                >
                Save Draft
                </v-btn>
                <v-btn class="bg-primary text-secondary ms-6"
                :disabled="true"
                >
                Create Proposal
                </v-btn>
              </div>
            </v-row>
          </v-container>
        </v-form>
      </div>
    </div>
  </template>
  
<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import {
  PositionType
} from "~/types/enums/position_type";
import { ValuationType } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
  
  const emit = defineEmits(["updateBreadcrumbs"]);
  
  const { selectedFundSlug, fundManagedNAVMethods } = toRefs(useFundStore());
  
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      title: "NAV Methods",
      disabled: false,
      to: `/details/${selectedFundSlug.value}/nav`,
    },
    {
      title: "Manage NAV Methods",
      disabled: false,
      to: `/details/${selectedFundSlug.value}/nav/manage`,
    },
    {
      title: "Create NAV Proposal",
      disabled: true,
      to: `/details/${selectedFundSlug.value}/nav/proposal`,
    },
  ];

  const form = ref(null);
  const formIsValid = ref(false);

  const method = ref<INAVMethod>({
  positionName: "",
  valuationSource: "",
  positionType: PositionType.Liquid,
  valuationType: ValuationType.DEXPair,
  details: [
    {},
  ],
  detailsJson: "",
});
  
  onMounted(() => {
    emit("updateBreadcrumbs", breadcrumbItems);
  });
  </script>
  
  <style scoped lang="scss">

  .last-update{
    color: $color-subtitle;
    font-weight: 500;
    font-size: $text-sm;
  }

  .header{
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: .62rem;
  }

  .form-col{
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: .69rem;
  }

  .sub-text{
    display: flex;
    flex-direction: row;
    color: $color-subtitle;
    font-size: $text-sm;
    font-weight: 400;
    align-items: center;
    gap: .25rem;
  }

  .section{
    margin-bottom: 2.94rem;
  }
  
  .management{
    width: 100%;
    display: flex;
    flex-direction: column;
    @include borderGray;
    padding: .5rem;
    margin: .69rem 0;

    &__card{
      width: 100%;
      padding: .88rem .5rem;
      border-radius: 0.25rem;
      background: $color-surface;
      margin-bottom: .12rem;
      font-size: $text-md;
      font-weight: 400;
    }

    &__card-no-margin{
      width: 100%;
      padding: .88rem .5rem;
      border-radius: 0.25rem;
      background: $color-surface;
      font-size: $text-md;
      font-weight: 400;
    }

    &__info{
      @include borderGray;
      display: flex;
      flex-direction: row;
      gap: .25rem;
      padding: .25rem;
      background-color: $color-background-button;
      color: $color-subtitle;
      font-weight: 700;
      font-size: $text-sm;
      text-transform: uppercase;
    }

    &__row{
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  .proposal{
    margin-top: 2.25rem;
    margin-bottom: 1.5rem;
  }

  .changes{
    display: flex;
    flex-direction: row;
    gap: .5rem;
    margin-top: 3.44rem;
    font-weight: 500;
    font-size: $text-sm;
    margin-bottom: 3.38rem;
  }

  .action-buttons{
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: end;
  }
  </style>
  