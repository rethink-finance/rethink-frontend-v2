<template>
  <nav class="navbar navbar-expand-xl navbar-dark primary-color">
    <div class="container-fluid">
      <router-link to="/" style="text-decoration: none">
        <a class="navbar-brand primary-color" href="/">
          <img src="@/assets/logo.svg" alt="" width="30" height="24" />
          Rethink Finance
        </a>
      </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon" />
      </button>

      <div id="navbarSupportedContent" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0 text-uppercase">
          <!-- Nav Item - Display Funds -->
          <router-link v-if="isUserConnected" to="/display" style="text-decoration: none">
            <li class="nav-item">
              <a class="nav-link" :class="{ active: $route.name === 'display' }" href="/display">Display Funds</a>
            </li>
          </router-link>
          <!-- END Nav Item - Display Funds -->

          <!-- Nav Item - Create Funds -->
          <router-link v-if="isUserConnected" to="/create" style="text-decoration: none">
            <li class="nav-item">
              <a class="nav-link" :class="{ active: $route.name === 'create' }" href="/create">Create Fund</a>
            </li>
          </router-link>
          <!-- END Nav Item - Create Funds -->

          <li v-if="isUserConnected" class="nav-item dropdown">
            <a
              id="navbarDropdown"
              class="nav-link dropdown-toggle primary-color"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              More
            </a>
            <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
              <li class="nav-item col mt-4">
                <a href="https://discord.gg/dB9yaEf5YQ" target="_blank" class="btn btn-social">
                  <i class="fab fa-discord" />
                </a>
              </li>

              <li class="nav-item col mt-4">
                <a href="https://twitter.com/RethinkProtocol" target="_blank" class="btn btn-social">
                  <i class="fab fa-twitter" />
                </a>
              </li>

              <li class="nav-item col mt-4">
                <a href="https://github.com/rethink-finance" target="_blank" class="btn btn-social">
                  <i class="fab fa-github" />
                </a>
              </li>
            </ul>
          </li>
        </ul>

        <ul v-if="!isUserConnected" class="navbar-nav ms-auto mb-2 mb-lg-0 text-uppercase mx-5">
          <li class="nav-item ml-40-px dropdown">
            <a
              id="navbarDropdown"
              class="nav-link dropdown-toggle primary-color"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Community
            </a>
            <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
              <li class="nav-item col mt-4">
                <a href="https://discord.gg/dB9yaEf5YQ" target="_blank" class="btn btn-social">
                  <i class="fab fa-discord" />
                </a>
              </li>

              <li class="nav-item col mt-4">
                <a href="https://twitter.com/RethinkProtocol" target="_blank" class="btn btn-social">
                  <i class="fab fa-twitter" />
                </a>
              </li>

              <li class="nav-item col mt-4">
                <a href="https://github.com/rethink-finance" target="_blank" class="btn btn-social">
                  <i class="fab fa-github" />
                </a>
              </li>
            </ul>
          </li>
        </ul>

        <div class="d-flex flex-wrap">
          <div v-if="isUserConnected" class="dropdown">
            <button
              v-if="getChainName"
              id="dropdownMenuButton1"
              class="btn btn-success dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {{ getChainName }}
            </button>

            <button
              v-if="!getChainName"
              id="dropdownMenuButton1"
              class="btn btn-danger dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Wrong network
            </button>

            <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton1">
              <li>
                <button class="dropdown-item" @click="switchToPolygon">Polygon PoS Chain</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToKovan">Kovan Testnet</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToMumbai">Mumbai Testnet</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToFuji">Fuji Testnet</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToCantoTestnet">Canto Testnet</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToArbitrumGoerli">Arbitrum Goerli Testnet</button>
              </li>
              <li>
                <button class="dropdown-item" @click="switchToGoerli">Goerli Testnet</button>
              </li>
            </ul>
          </div>

          <button
            v-if="!isUserConnected && isCompliant"
            class="btn btn-outline-success mx-1 mb-2 text-uppercase"
            @click="connectWeb3Modal"
          >
            Connect wallet
          </button>
          <button
            v-if="!isUserConnected && !isCompliant"
            class="btn btn-outline-success mx-1 mb-2 text-uppercase"
            data-bs-toggle="modal"
            data-bs-target="#complianceModal"
          >
            Connect wallet
          </button>
          <button v-if="isUserConnected" class="btn btn-outline-success mx-1 mb-2" @click="disconnectWeb3Modal">
            {{ getActiveAccount.substring(0, 6) }}...{{ getActiveAccount.substring(38, 42) }}
          </button>
        </div>
      </div>

      <!-- Compliance Modal -->
      <div
        id="complianceModal"
        class="modal fade"
        tabindex="-1"
        aria-labelledby="complianceModalLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 id="complianceModalLabel" class="modal-title">Information and Compliance</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>

            <ComplianceModalBody />

            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-primary"
                data-bs-dismiss="modal"
                @click="confirmComplianceAndConnect"
              >
                I confirm all of the above
              </button>
              <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
      <!-- End Compliance Modal -->
    </div>
  </nav>
</template>

<script>
import { mapGetters, mapActions } from "vuex";
import ComplianceModalBody from "./ComplianceModalBody.vue";

export default {
  name: "Navbar",

  components: {
    ComplianceModalBody,
  },

  computed: {
    ...mapGetters("accounts", [
      "getActiveAccount",
      "getChainName",
      "isUserConnected",
      "getWeb3Modal",
      "getSupportedChains",
    ]),

    getSupportedChainsString() {
      return String(this.getSupportedChains).replace("[", "").replace("]", "").replace(",", ", ");
    },
  },
  created() {
    this.$store.dispatch("accounts/initWeb3Modal");
    this.$store.dispatch("accounts/ethereumListener");

    // check if user has already confirmed the compliance modal
    this.isCompliant = localStorage.getItem("isCompliant");
  },

  data() {
    return {
      isCompliant: null,
    };
  },

  methods: {
    ...mapActions("accounts", ["connectWeb3Modal", "disconnectWeb3Modal"]),

    confirmComplianceAndConnect() {
      this.isCompliant = "true";
      localStorage.setItem("isCompliant", "true");

      this.connectWeb3Modal();
    },

    switchToPolygon() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x89",
              chainName: "Polygon PoS Chain",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com/"],
              blockExplorerUrls: ["https://polygonscan.com/"],
            },
          ],
        });
    },
    switchToKovan() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0x2a",
            },
          ],
        });
    },
    switchToMumbai() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0x13881",
            },
          ],
        });
    },
    switchToFuji() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0xa869",
            },
          ],
        });
    },
    switchToCantoTestnet() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0x1e15",
            },
          ],
        });
    },
    switchToArbitrumGoerli() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0x66eed",
            },
          ],
        });
    },
    switchToGoerli() {
      if (process.client)
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: "0x5",
            },
          ],
        });
    },
  },
};
</script>

<style scoped>
.ml-40-px {
  margin-left: 40px;
}

/* Mobile screens */
@media screen and (max-width: 1200px) {
  #navbarSupportedContent {
    margin-top: 10px;
  }

  .ml-40-px {
    margin-left: 0px;
  }
}
</style>
