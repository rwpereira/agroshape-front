import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import { environment } from '../../environmensts/environment';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [GoogleMapsModule, HttpClientModule, CommonModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  mapOptions: google.maps.MapOptions = {
    center: { lat: -15.7801, lng: -47.9292 },
    zoom: 4,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    disableDoubleClickZoom: true,
    mapTypeControl: false,
  };

  polygons: google.maps.Polygon[] = [];
  mapData: any[] = []; // Armazena os dados brutos para filtragem
  geometryTypes: { name: string; enabled: boolean }[] = [
    { name: 'Imóvel', enabled: true },
    { name: 'Vegetação nativa', enabled: true },
    { name: 'Área de Preservação Permanente', enabled: true },
    { name: 'Área consolidada', enabled: true },
    { name: 'Reserva legal', enabled: true },
    { name: 'Focos de queimada', enabled: true }
  ];
  isFilterOpen: boolean = false; // Controla o estado do menu de filtros

  constructor(private http: HttpClient) { }


  // Função para abrir/fechar os filtros
  toggleFilters() {
    this.isFilterOpen = !this.isFilterOpen;
  }

  onMapDblClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      console.log(`Latitude: ${lat}, Longitude: ${lng}`);

      // Exibe o loading
      // Swal.fire({
      //   title: 'Carregando...',
      //   text: 'Buscando dados do imóvel',
      //   allowOutsideClick: false,
      //   didOpen: () => {
      //     Swal.showLoading(); // Mostra o ícone de loading
      //   }
      // });


      this.fetchCarCode(lat, lng);
    }
  }

  fetchCarCode(lat: number, lng: number) {
    const apiUrl = [environment.api, `consulta/busca-car?latitude=${lat}&longitude=${lng}`].join('/');
    this.http.get<any[]>(apiUrl).subscribe((data) => {
      console.log('Dados do busca-car:', data);
      if (data && data.length > 0 && data[0].cod_imovel) {
        const carCode = data[0].cod_imovel;
        console.log(`Código do imóvel encontrado: ${carCode}`);
        this.fetchPropertyData(carCode);

      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Nenhum imóvel encontrado',
          text: 'Não foi encontrado um código de imóvel na área clicada.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#007bff'
        });
        console.log('Nenhum código de imóvel encontrado.');
      }
    }, (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: 'Ocorreu um erro ao buscar o imóvel. Tente novamente.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#007bff'
      });
      console.error('Erro ao consultar busca-car:', error);
    });
  }

  fetchPropertyData(carCode: string) {
    const apiUrl = [
      environment.api,
      `poligono/imovel?codImovel=${carCode}&imovel=true&app=true&consolidada=true&hidrografia=true&pousio=true&reserva=true&restrito=true&servidao=true&vegetacao=true&desmatamento=true&focoQueimada=true`
    ].join('/');

    this.http.get<any[]>(apiUrl).subscribe((data) => {
      this.clearMap();
      // console.log('Dados da API poligono/imovel:', data);
      this.mapData = data; // Armazena os dados brutos
      this.updateMap(); // Atualiza o mapa com base nos filtros
      // Swal.close();
    }, (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: 'Ocorreu um erro ao carregar os dados do imóvel.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#007bff'
      });
      console.error('Erro ao consultar poligono/imovel:', error);
    });
  }

  clearMap() {
    this.polygons.forEach(polygon => polygon.setMap(null));
    this.polygons = [];
  }

  // Atualiza o mapa com base nos tipos de geometria habilitados
  updateMap() {
    this.clearMap();
    const filteredData = this.mapData.filter(item =>
      this.geometryTypes.some(type => type.name === item.tipoGeometria && type.enabled)
    );
    // console.log('filteredData:', filteredData);
    this.displayGeoJsonArray(filteredData);
  }

  // Processa o array de objetos com geojson e ajusta o mapa
  displayGeoJsonArray(data: any[]) {
    const bounds = new google.maps.LatLngBounds();

    data.forEach(item => {
      const geojson = item.geojson;
      const color = this.normalizeColor(item.cor_normal);

      if (geojson.type === 'Polygon') {
        this.addPolygon(geojson.coordinates, color, bounds);
      } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach((polygonCoords: any[]) => {
          this.addPolygon(polygonCoords, color, bounds);
        });
      }
    });

    if (this.polygons.length > 0 && this.map.googleMap) {
      this.map.googleMap.fitBounds(bounds);
      // Aguarda o mapa ajustar os bounds antes de fechar o loading
      google.maps.event.addListenerOnce(this.map.googleMap, 'bounds_changed', () => {
        Swal.close(); // Fecha o loading após o zoom ser aplicado
      });
    } else {
      Swal.close(); // Fecha o loading se não houver polígonos
    }

    if (this.polygons.length > 0 && this.map.googleMap) {
      this.map.googleMap.fitBounds(bounds);
    }
  }

  addPolygon(coordinates: any[], color: string, bounds: google.maps.LatLngBounds) {
    const paths = coordinates.map((ring: any[]) =>
      ring.map((coord: number[]) => ({ lat: coord[0], lng: coord[1] }))
    );

    const polygon = new google.maps.Polygon({
      paths: paths,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35
    });

    polygon.setMap(this.map.googleMap!);
    this.polygons.push(polygon);

    paths.forEach(ring => {
      ring.forEach(coord => {
        bounds.extend(coord);
      });
    });
  }

  normalizeColor(color: string): string {
    if (color.startsWith('#') && color.length === 9) {
      return `#${color.slice(3)}`;
    }
    return color;
  }

  // Função chamada ao mudar o estado de um checkbox
  onCheckboxChange() {
    this.updateMap();
  }
}